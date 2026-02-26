const PLAYER_COLOR_HEX = ['#42a5f5', '#ef5350', '#66bb6a', '#ffa726'];

export class RoundOverUI {
    constructor(container) {
        this.container = container;
        this.element = null;
        this.onNextRound = null;
        this.onRematch = null;
        this.onMenu = null;
    }

    _winClass(winnerId) {
        if (winnerId === 0) return 'draw';
        return `p${winnerId}-win`;
    }

    _scoreHTML(scores) {
        return scores.map((s, i) =>
            `<span class="p${i + 1}-score">${s}</span>`
        ).join('<span class="score-divider" style="color:rgba(255,255,255,0.3);margin:0 8px;">·</span>');
    }

    showRoundOver(winnerId, scores, round, maxRounds) {
        this.element = document.createElement('div');
        this.element.className = 'result-screen';

        const winClass = this._winClass(winnerId);
        const winText = winnerId === 0 ? 'DRAW!' : `PLAYER ${winnerId} WINS!`;

        this.element.innerHTML = `
            <div class="result-title ${winClass}">${winText}</div>
            <div class="result-subtitle">Round ${round} of ${maxRounds}</div>
            <div class="result-score">${this._scoreHTML(scores)}</div>
            <div class="result-buttons">
                <button class="menu-btn primary" id="btn-next-round">NEXT ROUND</button>
            </div>
        `;
        this.container.appendChild(this.element);

        document.getElementById('btn-next-round').addEventListener('click', () => {
            if (this.onNextRound) this.onNextRound();
        });
    }

    showGameOver(winnerId, scores) {
        this.element = document.createElement('div');
        this.element.className = 'result-screen';

        const winClass = this._winClass(winnerId);
        const winText = `PLAYER ${winnerId} WINS THE GAME!`;

        this.element.innerHTML = `
            <div class="result-title ${winClass}">${winText}</div>
            <div class="result-subtitle">Final Score</div>
            <div class="result-score">${this._scoreHTML(scores)}</div>
            <div class="result-buttons">
                <button class="menu-btn primary" id="btn-rematch">REMATCH</button>
                <button class="menu-btn" id="btn-menu">MAIN MENU</button>
            </div>
        `;
        this.container.appendChild(this.element);

        document.getElementById('btn-rematch').addEventListener('click', () => {
            if (this.onRematch) this.onRematch();
        });
        document.getElementById('btn-menu').addEventListener('click', () => {
            if (this.onMenu) this.onMenu();
        });
    }

    // Replace buttons with "Waiting for host..." for online client
    showWaitingOverlay() {
        if (!this.element) return;
        const buttons = this.element.querySelector('.result-buttons');
        if (buttons) {
            buttons.innerHTML = `
                <div class="online-waiting" style="margin-top:12px;">
                    <div class="online-status">Waiting for host...</div>
                    <div class="online-spinner"></div>
                </div>
            `;
        }
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
