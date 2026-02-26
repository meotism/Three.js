import { isOnlineAvailable } from '../net/SupabaseConfig.js';

export class ModeSelectUI {
    constructor(container) {
        this.container = container;
        this.element = null;
        this.onSelectSingle = null;
        this.onSelectDouble = null;
        this.onSelectOnline = null;
        this.onBack = null;
    }

    show(isMobile = false) {
        this.element = document.createElement('div');
        this.element.className = 'mode-select-screen';

        this.element.innerHTML = `
            <div class="mode-select-title">Select Mode</div>
            <div class="mode-cards">
                <div class="mode-card" id="mode-single">
                    <div class="mode-icon">🎮</div>
                    <div class="mode-name">Single Player</div>
                    <div class="mode-desc">You vs 3 AI Opponents</div>
                    <div class="mode-players">
                        <span class="mode-player-dot" style="background:#42a5f5;" title="P1 (You)"></span>
                        <span class="mode-player-dot ai" style="background:#ef5350;" title="AI"></span>
                        <span class="mode-player-dot ai" style="background:#66bb6a;" title="AI"></span>
                        <span class="mode-player-dot ai" style="background:#ffa726;" title="AI"></span>
                    </div>
                    <div class="mode-controls">P1: WASD + Space</div>
                </div>
                <div class="mode-card" id="mode-double">
                    <div class="mode-icon">👥</div>
                    <div class="mode-name">Double Players</div>
                    <div class="mode-desc">2 Players vs 2 AI</div>
                    <div class="mode-players">
                        <span class="mode-player-dot" style="background:#42a5f5;" title="P1"></span>
                        <span class="mode-player-dot" style="background:#ef5350;" title="P2"></span>
                        <span class="mode-player-dot ai" style="background:#66bb6a;" title="AI"></span>
                        <span class="mode-player-dot ai" style="background:#ffa726;" title="AI"></span>
                    </div>
                    <div class="mode-controls">P1: WASD + Space<br>P2: Arrows + Enter</div>
                </div>
                <div class="mode-card" id="mode-online">
                    <div class="mode-icon">🌐</div>
                    <div class="mode-name">Online</div>
                    <div class="mode-desc">Play with a friend online</div>
                    <div class="mode-players">
                        <span class="mode-player-dot" style="background:#42a5f5;" title="P1 (You)"></span>
                        <span class="mode-player-dot" style="background:#ef5350;" title="P2 (Friend)"></span>
                        <span class="mode-player-dot ai" style="background:#66bb6a;" title="AI"></span>
                        <span class="mode-player-dot ai" style="background:#ffa726;" title="AI"></span>
                    </div>
                    <div class="mode-controls">2 Players + 2 AI online</div>
                </div>
            </div>
            <div class="mode-select-actions">
                <button class="menu-btn" id="mode-back">BACK</button>
            </div>
        `;
        this.container.appendChild(this.element);

        document.getElementById('mode-single').addEventListener('click', () => {
            if (this.onSelectSingle) this.onSelectSingle();
        });

        const doubleCard = document.getElementById('mode-double');
        if (isMobile) {
            doubleCard.classList.add('mode-card-disabled');
            doubleCard.querySelector('.mode-controls').innerHTML = '⚠️ Keyboard required';
            doubleCard.addEventListener('click', () => {
                const toast = document.createElement('div');
                toast.className = 'mobile-toast';
                toast.textContent = 'Double player requires keyboard';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
            });
        } else {
            doubleCard.addEventListener('click', () => {
                if (this.onSelectDouble) this.onSelectDouble();
            });
        }

        const onlineCard = document.getElementById('mode-online');
        if (isOnlineAvailable()) {
            onlineCard.addEventListener('click', () => {
                if (this.onSelectOnline) this.onSelectOnline();
            });
        } else {
            onlineCard.classList.add('mode-card-disabled');
            onlineCard.querySelector('.mode-controls').innerHTML = '⚠️ Not available in dev mode';
        }

        document.getElementById('mode-back').addEventListener('click', () => {
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
