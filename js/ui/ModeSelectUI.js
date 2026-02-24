export class ModeSelectUI {
    constructor(container) {
        this.container = container;
        this.element = null;
        this.onSelectSingle = null;
        this.onSelectDouble = null;
        this.onBack = null;
    }

    show() {
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
            </div>
            <div class="mode-select-actions">
                <button class="menu-btn" id="mode-back">BACK</button>
            </div>
        `;
        this.container.appendChild(this.element);

        document.getElementById('mode-single').addEventListener('click', () => {
            if (this.onSelectSingle) this.onSelectSingle();
        });
        document.getElementById('mode-double').addEventListener('click', () => {
            if (this.onSelectDouble) this.onSelectDouble();
        });
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
