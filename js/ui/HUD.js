export class HUD {
    constructor(container) {
        this.container = container;
        this.element = null;
    }

    show(round, maxRounds, p1Score, p2Score) {
        this.element = document.createElement('div');
        this.element.className = 'hud';
        this.element.innerHTML = `
            <div class="hud-player p1">
                <div class="hud-player-icon">P1</div>
                <div class="hud-stats">
                    <div class="hud-stat"><span class="hud-stat-icon">💣</span><span id="p1-bombs">1</span></div>
                    <div class="hud-stat"><span class="hud-stat-icon">🔥</span><span id="p1-range">1</span></div>
                    <div class="hud-stat"><span class="hud-stat-icon">⚡</span><span id="p1-speed">1.0</span></div>
                </div>
            </div>
            <div class="hud-center">
                <div class="hud-round">Round ${round}/${maxRounds}</div>
                <div class="hud-score">
                    <span class="p1-score">${p1Score}</span>
                    <span class="score-divider">-</span>
                    <span class="p2-score">${p2Score}</span>
                </div>
            </div>
            <div class="hud-player p2">
                <div class="hud-stats">
                    <div class="hud-stat"><span class="hud-stat-icon">💣</span><span id="p2-bombs">1</span></div>
                    <div class="hud-stat"><span class="hud-stat-icon">🔥</span><span id="p2-range">1</span></div>
                    <div class="hud-stat"><span class="hud-stat-icon">⚡</span><span id="p2-speed">1.0</span></div>
                </div>
                <div class="hud-player-icon">P2</div>
            </div>
        `;
        this.container.appendChild(this.element);
    }

    update(p1, p2) {
        const el = (id) => document.getElementById(id);
        if (el('p1-bombs')) el('p1-bombs').textContent = p1.maxBombs;
        if (el('p1-range')) el('p1-range').textContent = p1.bombRange;
        if (el('p1-speed')) el('p1-speed').textContent = (p1.speed / 4).toFixed(1);
        if (el('p2-bombs')) el('p2-bombs').textContent = p2.maxBombs;
        if (el('p2-range')) el('p2-range').textContent = p2.bombRange;
        if (el('p2-speed')) el('p2-speed').textContent = (p2.speed / 4).toFixed(1);
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
