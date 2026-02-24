const PLAYER_COLOR_HEX = ['#42a5f5', '#ef5350', '#66bb6a', '#ffa726'];
const PLAYER_NAMES = ['P1', 'P2', 'P3', 'P4'];

export class HUD {
    constructor(container) {
        this.container = container;
        this.element = null;
    }

    show(round, maxRounds, scores, players) {
        this.element = document.createElement('div');
        this.element.className = 'hud';

        let leftHTML = '';
        let rightHTML = '';

        for (let i = 0; i < 4; i++) {
            const isNPC = players[i].isNPC;
            const badge = isNPC ? '<span class="npc-badge">AI</span>' : '';
            const side = i < 2 ? 'left' : 'right';
            const playerHTML = `
                <div class="hud-player p${i + 1}">
                    <div class="hud-player-icon">${PLAYER_NAMES[i]}${badge}</div>
                    <div class="hud-stats">
                        <div class="hud-stat"><span class="hud-stat-icon">💣</span><span id="p${i + 1}-bombs">1</span></div>
                        <div class="hud-stat"><span class="hud-stat-icon">🔥</span><span id="p${i + 1}-range">1</span></div>
                        <div class="hud-stat"><span class="hud-stat-icon">⚡</span><span id="p${i + 1}-speed">1.0</span></div>
                    </div>
                </div>
            `;
            if (side === 'left') leftHTML += playerHTML;
            else rightHTML += playerHTML;
        }

        const scoreHTML = scores.map((s, i) =>
            `<span class="p${i + 1}-score">${s}</span>`
        ).join('<span class="score-divider">·</span>');

        this.element.innerHTML = `
            <div class="hud-side hud-left">${leftHTML}</div>
            <div class="hud-center">
                <div class="hud-round">Round ${round}/${maxRounds}</div>
                <div class="hud-score">${scoreHTML}</div>
            </div>
            <div class="hud-side hud-right">${rightHTML}</div>
        `;
        this.container.appendChild(this.element);
    }

    updateStats(players) {
        const el = (id) => document.getElementById(id);
        for (let i = 0; i < players.length; i++) {
            const p = players[i].player;
            const n = i + 1;
            if (el(`p${n}-bombs`)) el(`p${n}-bombs`).textContent = p.maxBombs;
            if (el(`p${n}-range`)) el(`p${n}-range`).textContent = p.bombRange;
            if (el(`p${n}-speed`)) el(`p${n}-speed`).textContent = (p.speed / 4).toFixed(1);
        }
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
