/**
 * PeerManager — WebRTC DataChannel manager for P2P game data.
 *
 * Star topology: host maintains one RTCPeerConnection per client.
 * Uses a Supabase broadcast channel for SDP/ICE signaling only.
 * All game data flows through unreliable/unordered DataChannels (UDP-like).
 */
export class PeerManager {
    constructor() {
        /** @type {Map<number, RTCPeerConnection>} playerId → connection */
        this.peers = new Map();
        /** @type {Map<number, RTCDataChannel>} playerId → channel */
        this.dataChannels = new Map();

        this.isHost = false;
        this.localPlayerId = null;

        /** @type {Set<number>} playerIds with open DataChannels */
        this.readyPeers = new Set();

        // Supabase channel ref (signaling only)
        this._signalingChannel = null;

        // Buffered signals that arrived before localPlayerId was set
        this._pendingSignals = [];
        // Buffered ICE candidates that arrived before remoteDescription was set
        this._pendingCandidates = new Map(); // playerId → [RTCIceCandidate]

        this._iceConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        };

        // Callbacks
        this.onDataChannelMessage = null; // (playerId, {event, payload})
        this.onPeerConnected = null;      // (playerId)
        this.onPeerDisconnected = null;   // (playerId)
        this.onError = null;              // (error)
    }

    // ---- Signaling setup ----

    setSignalingChannel(channel) {
        this._signalingChannel = channel;

        channel.on('broadcast', { event: 'webrtc_offer' }, ({ payload }) => {
            if (this.localPlayerId === null) {
                this._pendingSignals.push({ type: 'offer', payload });
                return;
            }
            if (payload.to === this.localPlayerId) {
                this._handleOffer(payload.from, payload.sdp);
            }
        });

        channel.on('broadcast', { event: 'webrtc_answer' }, ({ payload }) => {
            if (this.localPlayerId === null) {
                this._pendingSignals.push({ type: 'answer', payload });
                return;
            }
            if (payload.to === this.localPlayerId) {
                this._handleAnswer(payload.from, payload.sdp);
            }
        });

        channel.on('broadcast', { event: 'webrtc_ice' }, ({ payload }) => {
            if (this.localPlayerId === null) {
                this._pendingSignals.push({ type: 'ice', payload });
                return;
            }
            if (payload.to === this.localPlayerId) {
                this._handleIceCandidate(payload.from, payload.candidate);
            }
        });
    }

    /** Call after the client receives its playerId from host. */
    setLocalPlayerId(id) {
        this.localPlayerId = id;
        // Flush buffered signals
        for (const sig of this._pendingSignals) {
            if (sig.payload.to !== id) continue;
            switch (sig.type) {
                case 'offer':  this._handleOffer(sig.payload.from, sig.payload.sdp); break;
                case 'answer': this._handleAnswer(sig.payload.from, sig.payload.sdp); break;
                case 'ice':    this._handleIceCandidate(sig.payload.from, sig.payload.candidate); break;
            }
        }
        this._pendingSignals = [];
    }

    // ---- Connection initiation (host calls this per client) ----

    async initiateConnection(remotePlayerId) {
        if (this.peers.has(remotePlayerId)) return; // already connecting

        const pc = new RTCPeerConnection(this._iceConfig);
        this.peers.set(remotePlayerId, pc);

        // Host creates the DataChannel
        const dc = pc.createDataChannel('game', {
            ordered: false,
            maxRetransmits: 0,
        });
        this._setupDataChannel(remotePlayerId, dc);

        this._setupIceAndState(pc, remotePlayerId);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this._signalingChannel.send({
            type: 'broadcast',
            event: 'webrtc_offer',
            payload: { from: this.localPlayerId, to: remotePlayerId, sdp: pc.localDescription },
        });
    }

    // ---- Signaling handlers ----

    async _handleOffer(fromPlayerId, sdp) {
        if (this.peers.has(fromPlayerId)) return; // duplicate

        const pc = new RTCPeerConnection(this._iceConfig);
        this.peers.set(fromPlayerId, pc);

        // Client receives the DataChannel from host
        pc.ondatachannel = (event) => {
            this._setupDataChannel(fromPlayerId, event.channel);
        };

        this._setupIceAndState(pc, fromPlayerId);

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await this._flushPendingCandidates(fromPlayerId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this._signalingChannel.send({
            type: 'broadcast',
            event: 'webrtc_answer',
            payload: { from: this.localPlayerId, to: fromPlayerId, sdp: pc.localDescription },
        });
    }

    async _handleAnswer(fromPlayerId, sdp) {
        const pc = this.peers.get(fromPlayerId);
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await this._flushPendingCandidates(fromPlayerId);
    }

    async _handleIceCandidate(fromPlayerId, candidate) {
        const pc = this.peers.get(fromPlayerId);
        if (!pc || !pc.remoteDescription) {
            // Buffer until remoteDescription is set
            if (!this._pendingCandidates.has(fromPlayerId)) {
                this._pendingCandidates.set(fromPlayerId, []);
            }
            this._pendingCandidates.get(fromPlayerId).push(candidate);
            return;
        }
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
            // Non-fatal: some candidates arrive after connection is established
        }
    }

    async _flushPendingCandidates(playerId) {
        const pending = this._pendingCandidates.get(playerId);
        if (!pending) return;
        const pc = this.peers.get(playerId);
        if (!pc) return;
        for (const candidate of pending) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) { /* ignore late candidates */ }
        }
        this._pendingCandidates.delete(playerId);
    }

    // ---- Shared setup helpers ----

    _setupIceAndState(pc, remotePlayerId) {
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this._signalingChannel.send({
                    type: 'broadcast',
                    event: 'webrtc_ice',
                    payload: {
                        from: this.localPlayerId,
                        to: remotePlayerId,
                        candidate: event.candidate,
                    },
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            if (state === 'failed' || state === 'closed') {
                this._handlePeerFailure(remotePlayerId);
            }
        };
    }

    _setupDataChannel(playerId, channel) {
        this.dataChannels.set(playerId, channel);

        channel.onopen = () => {
            this.readyPeers.add(playerId);
            if (this.onPeerConnected) this.onPeerConnected(playerId);
        };

        channel.onclose = () => {
            this.readyPeers.delete(playerId);
            if (this.onPeerDisconnected) this.onPeerDisconnected(playerId);
        };

        channel.onerror = (err) => {
            console.error(`[PeerManager] DataChannel error with player ${playerId}:`, err);
        };

        channel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (this.onDataChannelMessage) this.onDataChannelMessage(playerId, msg);
            } catch (e) {
                console.error('[PeerManager] Failed to parse message:', e);
            }
        };
    }

    _handlePeerFailure(playerId) {
        this.readyPeers.delete(playerId);
        if (this.onPeerDisconnected) this.onPeerDisconnected(playerId);
    }

    // ---- Sending ----

    send(playerId, messageObj) {
        const dc = this.dataChannels.get(playerId);
        if (dc && dc.readyState === 'open') {
            dc.send(JSON.stringify(messageObj));
        }
    }

    broadcast(messageObj) {
        const data = JSON.stringify(messageObj);
        for (const [, dc] of this.dataChannels) {
            if (dc.readyState === 'open') {
                dc.send(data);
            }
        }
    }

    // ---- Cleanup ----

    closePeer(playerId) {
        const dc = this.dataChannels.get(playerId);
        if (dc) {
            dc.close();
            this.dataChannels.delete(playerId);
        }
        const pc = this.peers.get(playerId);
        if (pc) {
            pc.close();
            this.peers.delete(playerId);
        }
        this.readyPeers.delete(playerId);
    }

    destroy() {
        for (const [id] of this.peers) {
            this.closePeer(id);
        }
        this._pendingSignals = [];
        this._pendingCandidates.clear();
        this._signalingChannel = null;
    }
}
