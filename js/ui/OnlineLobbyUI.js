export class OnlineLobbyUI {
    constructor(container) {
        this.container = container;
        this.element = null;

        // Callbacks
        this.onCreateRoom = null;
        this.onJoinRoom = null;
        this.onBack = null;
        this.onCancel = null;
        this.onStart = null; // host clicks START
    }

    showLobbyChoice() {
        this.hide();
        this.element = document.createElement('div');
        this.element.className = 'mode-select-screen';

        this.element.innerHTML = `
            <div class="mode-select-title">Online Play</div>
            <div class="mode-cards">
                <div class="mode-card" id="online-create">
                    <div class="mode-icon">🏠</div>
                    <div class="mode-name">Create Room</div>
                    <div class="mode-desc">Host a game and share the code</div>
                </div>
                <div class="mode-card" id="online-join">
                    <div class="mode-icon">🔗</div>
                    <div class="mode-name">Join Room</div>
                    <div class="mode-desc">Enter a room code to join</div>
                </div>
            </div>
            <div class="mode-select-actions">
                <button class="menu-btn" id="online-back">BACK</button>
            </div>
        `;
        this.container.appendChild(this.element);

        document.getElementById('online-create').addEventListener('click', () => {
            if (this.onCreateRoom) this.onCreateRoom();
        });
        document.getElementById('online-join').addEventListener('click', () => {
            this.showJoinInput();
        });
        document.getElementById('online-back').addEventListener('click', () => {
            if (this.onBack) this.onBack();
        });
    }

    showJoinInput() {
        this.hide();
        this.element = document.createElement('div');
        this.element.className = 'mode-select-screen';

        this.element.innerHTML = `
            <div class="mode-select-title">Join Room</div>
            <div class="online-join-form">
                <input type="text" id="room-code-input" class="room-code-input"
                       maxlength="6" placeholder="ENTER CODE"
                       autocomplete="off" autocorrect="off" autocapitalize="characters">
                <button class="menu-btn primary" id="join-submit">JOIN</button>
            </div>
            <div id="join-error" class="online-error"></div>
            <div class="mode-select-actions">
                <button class="menu-btn" id="join-back">BACK</button>
            </div>
        `;
        this.container.appendChild(this.element);

        const input = document.getElementById('room-code-input');
        input.focus();
        input.addEventListener('input', () => {
            input.value = input.value.toUpperCase().replace(/[^A-Z2-9]/g, '');
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const code = input.value.trim();
                if (code.length === 6 && this.onJoinRoom) this.onJoinRoom(code);
            }
        });

        document.getElementById('join-submit').addEventListener('click', () => {
            const code = input.value.trim();
            if (code.length === 6 && this.onJoinRoom) {
                this.onJoinRoom(code);
            } else {
                document.getElementById('join-error').textContent = 'Code must be 6 characters';
            }
        });
        document.getElementById('join-back').addEventListener('click', () => {
            this.showLobbyChoice();
        });
    }

    showWaiting(roomCode, isHost) {
        this.hide();
        this.element = document.createElement('div');
        this.element.className = 'mode-select-screen';

        if (isHost) {
            // Host: show room code, player count, and START button
            this.element.innerHTML = `
                <div class="mode-select-title">Room Created</div>
                <div class="online-waiting">
                    <div class="online-status">Share this code with friends:</div>
                    <div class="room-code-display">${roomCode}</div>
                    <div class="player-count" id="player-count">Players: 1 / 4</div>
                    <div class="online-spinner"></div>
                </div>
                <div class="mode-select-actions">
                    <button class="menu-btn primary" id="host-start" disabled>START</button>
                    <button class="menu-btn" id="waiting-cancel">CANCEL</button>
                </div>
            `;
        } else {
            // Client: show connecting
            this.element.innerHTML = `
                <div class="mode-select-title">Joining Room</div>
                <div class="online-waiting">
                    <div class="online-status">Connecting to room...</div>
                    <div class="player-count" id="player-count"></div>
                    <div class="online-spinner"></div>
                </div>
                <div class="mode-select-actions">
                    <button class="menu-btn" id="waiting-cancel">CANCEL</button>
                </div>
            `;
        }
        this.container.appendChild(this.element);

        const startBtn = document.getElementById('host-start');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (this.onStart) this.onStart();
            });
        }

        document.getElementById('waiting-cancel').addEventListener('click', () => {
            if (this.onCancel) this.onCancel();
        });
    }

    // Update the player count display (called when players join/leave)
    updatePlayerCount(count) {
        const el = this.element?.querySelector('#player-count');
        if (el) {
            el.textContent = `Players: ${count} / 4`;
        }

        // Enable START button when 2+ players
        const startBtn = this.element?.querySelector('#host-start');
        if (startBtn) {
            startBtn.disabled = count < 2;
        }
    }

    showConnected(roomCode) {
        this.hide();
        this.element = document.createElement('div');
        this.element.className = 'mode-select-screen';
        this.element.innerHTML = `
            <div class="mode-select-title" style="color:#66bb6a;">Connected!</div>
            <div class="online-status">Room: ${roomCode}</div>
        `;
        this.container.appendChild(this.element);
    }

    showWaitingForHost(message) {
        this.hide();
        this.element = document.createElement('div');
        this.element.className = 'mode-select-screen';
        this.element.innerHTML = `
            <div class="mode-select-title">Waiting for Host</div>
            <div class="online-waiting">
                <div class="online-status">${message || 'Host is selecting a map...'}</div>
                <div class="player-count" id="player-count"></div>
                <div class="online-spinner"></div>
            </div>
        `;
        this.container.appendChild(this.element);
    }

    showDisconnected(message) {
        this.hide();
        this.element = document.createElement('div');
        this.element.className = 'mode-select-screen';
        this.element.innerHTML = `
            <div class="mode-select-title" style="color:#ef5350;">Disconnected</div>
            <div class="online-status">${message || 'The other player left the game.'}</div>
            <div class="mode-select-actions">
                <button class="menu-btn primary" id="dc-menu">MAIN MENU</button>
            </div>
        `;
        this.container.appendChild(this.element);

        document.getElementById('dc-menu').addEventListener('click', () => {
            if (this.onBack) this.onBack();
        });
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
