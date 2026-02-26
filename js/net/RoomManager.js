import { SUPABASE_URL, SUPABASE_ANON_KEY } from './SupabaseConfig.js';

export class RoomManager {
    constructor() {
        this.supabase = null;
        this.channel = null;
        this.roomCode = null;
        this.isHost = false;
        this.playerId = null; // 1 = host, 2-4 = joiners
        this.playerCount = 0;

        // Track assigned player IDs (host only)
        this._nextPlayerId = 2;
        this._assignedPlayers = new Map(); // presenceKey → playerId

        // Callbacks — set by Game.js
        this.onPeerJoin = null;
        this.onPeerLeave = null;
        this.onPlayerCountChange = null;
        this.onGameState = null;
        this.onRemoteInput = null;
        this.onMapSelected = null;
        this.onGameEvent = null;
        this.onError = null;
        this.onPlayerAssigned = null; // client receives assigned playerId
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
        this._nextPlayerId = 2;
        this._assignedPlayers.clear();
        this._setupChannel();
        return this.roomCode;
    }

    async joinRoom(code) {
        this._initClient();
        this.roomCode = code.toUpperCase().trim();
        this.isHost = false;
        this.playerId = null; // will be assigned by host
        this._setupChannel();
    }

    _setupChannel() {
        const presenceKey = this.isHost
            ? 'player_1'
            : `joiner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        this.channel = this.supabase.channel(`room:${this.roomCode}`, {
            config: { presence: { key: presenceKey } },
        });

        // --- Presence ---
        this.channel.on('presence', { event: 'sync' }, () => {
            const state = this.channel.presenceState();
            const count = Object.keys(state).length;
            const prevCount = this.playerCount;
            this.playerCount = count;

            if (this.onPlayerCountChange) this.onPlayerCountChange(count);

            // Host assigns IDs to new joiners
            if (this.isHost && count > prevCount) {
                this._assignNewPlayers(state);
            }

            // Fire onPeerJoin when first joiner appears
            if (count >= 2 && prevCount < 2) {
                if (this.onPeerJoin) this.onPeerJoin();
            }
        });

        this.channel.on('presence', { event: 'leave' }, ({ key }) => {
            const state = this.channel.presenceState();
            const count = Object.keys(state).length;
            this.playerCount = count;

            if (this.onPlayerCountChange) this.onPlayerCountChange(count);

            // Remove the assigned player ID for the leaver
            if (this.isHost && key && this._assignedPlayers.has(key)) {
                this._assignedPlayers.delete(key);
            }

            if (count < 2) {
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
            if (!this.isHost && this.onMapSelected) this.onMapSelected(payload.mapIndex, payload.humanCount);
        });

        this.channel.on('broadcast', { event: 'game_event' }, ({ payload }) => {
            if (!this.isHost && this.onGameEvent) this.onGameEvent(payload);
        });

        // Client listens for player ID assignment
        this.channel.on('broadcast', { event: 'player_id_assigned' }, ({ payload }) => {
            if (!this.isHost && payload.presenceKey === presenceKey) {
                this.playerId = payload.playerId;
                if (this.onPlayerAssigned) this.onPlayerAssigned(payload.playerId);
            }
        });

        // --- Subscribe & track presence ---
        this.channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await this.channel.track({
                    player_id: this.playerId || 0,
                    joined_at: Date.now(),
                });
            } else if (status === 'CHANNEL_ERROR') {
                if (this.onError) this.onError('Failed to connect to room');
            }
        });
    }

    // Host assigns player IDs to new joiners
    _assignNewPlayers(state) {
        for (const key of Object.keys(state)) {
            if (key === 'player_1') continue; // skip host
            if (this._assignedPlayers.has(key)) continue; // already assigned
            if (this._nextPlayerId > 4) continue; // room full

            const assignedId = this._nextPlayerId++;
            this._assignedPlayers.set(key, assignedId);

            // Tell the joiner their player ID
            this.channel.send({
                type: 'broadcast',
                event: 'player_id_assigned',
                payload: { presenceKey: key, playerId: assignedId },
            });
        }
    }

    // ---- Broadcast helpers ----

    broadcastGameState(state) {
        if (!this.channel || !this.isHost) return;
        this.channel.send({ type: 'broadcast', event: 'game_state', payload: state });
    }

    broadcastInput(inputState) {
        if (!this.channel || this.isHost) return;
        // Include playerId so host knows which player this input is for
        this.channel.send({
            type: 'broadcast',
            event: 'player_input',
            payload: { ...inputState, playerId: this.playerId },
        });
    }

    broadcastMapSelected(mapIndex, humanCount) {
        if (!this.channel || !this.isHost) return;
        this.channel.send({ type: 'broadcast', event: 'map_selected', payload: { mapIndex, humanCount } });
    }

    broadcastGameEvent(event) {
        if (!this.channel || !this.isHost) return;
        this.channel.send({ type: 'broadcast', event: 'game_event', payload: event });
    }

    // Get current number of online human players (including host)
    getHumanCount() {
        return Math.min(this.playerCount, 4);
    }

    destroy() {
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }
        this.playerCount = 0;
        this._assignedPlayers.clear();
        this._nextPlayerId = 2;
        this.roomCode = null;
        this.supabase = null;
    }
}
