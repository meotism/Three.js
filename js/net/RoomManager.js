import { SUPABASE_URL, SUPABASE_ANON_KEY } from './SupabaseConfig.js';

export class RoomManager {
    constructor() {
        this.supabase = null;
        this.channel = null;
        this.roomCode = null;
        this.isHost = false;
        this.playerId = null; // 1 = host, 2 = client
        this.peerConnected = false;

        // Callbacks — set by Game.js
        this.onPeerJoin = null;
        this.onPeerLeave = null;
        this.onGameState = null;
        this.onRemoteInput = null;
        this.onMapSelected = null;
        this.onGameEvent = null;
        this.onError = null;
    }

    _initClient() {
        if (this.supabase) return;
        const { createClient } = window.supabase;
        this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    _generateRoomCode() {
        // Ambiguity-free charset (no I, O, 0, 1)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    async createRoom() {
        this._initClient();
        this.roomCode = this._generateRoomCode();
        this.isHost = true;
        this.playerId = 1;
        this._setupChannel();
        return this.roomCode;
    }

    async joinRoom(code) {
        this._initClient();
        this.roomCode = code.toUpperCase().trim();
        this.isHost = false;
        this.playerId = 2;
        this._setupChannel();
    }

    _setupChannel() {
        this.channel = this.supabase.channel(`room:${this.roomCode}`, {
            config: { presence: { key: `player_${this.playerId}` } },
        });

        // --- Presence ---
        this.channel.on('presence', { event: 'sync' }, () => {
            const state = this.channel.presenceState();
            const playerCount = Object.keys(state).length;
            if (playerCount >= 2 && !this.peerConnected) {
                this.peerConnected = true;
                if (this.onPeerJoin) this.onPeerJoin();
            }
        });

        this.channel.on('presence', { event: 'leave' }, () => {
            const state = this.channel.presenceState();
            const playerCount = Object.keys(state).length;
            if (playerCount < 2 && this.peerConnected) {
                this.peerConnected = false;
                if (this.onPeerLeave) this.onPeerLeave();
            }
        });

        // --- Broadcast listeners ---
        this.channel.on('broadcast', { event: 'game_state' }, ({ payload }) => {
            if (!this.isHost && this.onGameState) this.onGameState(payload);
        });

        this.channel.on('broadcast', { event: 'player_input' }, ({ payload }) => {
            if (this.isHost && this.onRemoteInput) this.onRemoteInput(payload);
        });

        this.channel.on('broadcast', { event: 'map_selected' }, ({ payload }) => {
            if (!this.isHost && this.onMapSelected) this.onMapSelected(payload.mapIndex);
        });

        this.channel.on('broadcast', { event: 'game_event' }, ({ payload }) => {
            if (!this.isHost && this.onGameEvent) this.onGameEvent(payload);
        });

        // --- Subscribe & track presence ---
        this.channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await this.channel.track({
                    player_id: this.playerId,
                    joined_at: Date.now(),
                });
            } else if (status === 'CHANNEL_ERROR') {
                if (this.onError) this.onError('Failed to connect to room');
            }
        });
    }

    // ---- Broadcast helpers ----

    broadcastGameState(state) {
        if (!this.channel || !this.isHost) return;
        this.channel.send({ type: 'broadcast', event: 'game_state', payload: state });
    }

    broadcastInput(inputState) {
        if (!this.channel || this.isHost) return;
        this.channel.send({ type: 'broadcast', event: 'player_input', payload: inputState });
    }

    broadcastMapSelected(mapIndex) {
        if (!this.channel || !this.isHost) return;
        this.channel.send({ type: 'broadcast', event: 'map_selected', payload: { mapIndex } });
    }

    broadcastGameEvent(event) {
        if (!this.channel || !this.isHost) return;
        this.channel.send({ type: 'broadcast', event: 'game_event', payload: event });
    }

    destroy() {
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }
        this.peerConnected = false;
        this.roomCode = null;
        this.supabase = null;
    }
}
