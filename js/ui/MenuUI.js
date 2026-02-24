export class MenuUI {
    constructor(container) {
        this.container = container;
        this.element = null;
        this.onStart = null;
        this.onHowToPlay = null;
    }

    show() {
        this.element = document.createElement('div');
        this.element.className = 'menu-screen';
        this.element.innerHTML = `
            <button class="donate-btn" id="donate-btn">
                ☕ Buy Me Coffee
            </button>
            <div class="game-title">BOOM IT 5</div>
            <div class="game-subtitle">3D Bomberman</div>
            <div class="menu-buttons">
                <button class="menu-btn primary" id="btn-start">START GAME</button>
                <button class="menu-btn" id="btn-howto">HOW TO PLAY</button>
            </div>
        `;
        this.container.appendChild(this.element);

        document.getElementById('btn-start').addEventListener('click', () => {
            if (this.onStart) this.onStart();
        });
        document.getElementById('btn-howto').addEventListener('click', () => {
            this.showHowToPlay();
        });
        document.getElementById('donate-btn').addEventListener('click', () => {
            this.showDonateModal();
        });
    }

    showDonateModal() {
        const modal = document.createElement('div');
        modal.className = 'donate-modal';
        modal.innerHTML = `
            <div class="donate-modal-content">
                <h2>☕ Buy Me Coffee</h2>
                <p>If you enjoy this game, consider supporting the developer!</p>
                <img src="./assets/qr-donate.png" alt="Donate QR Code" class="donate-qr-img" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                <p style="display:none;color:rgba(255,255,255,0.4);font-size:12px;">Place qr-donate.png in assets/ folder</p>
                <p style="font-size:13px;color:rgba(255,255,255,0.5);">Scan with MoMo or banking app</p>
                <button class="donate-close-btn" id="donate-close">Close</button>
            </div>
        `;
        this.container.appendChild(modal);

        const close = () => {
            modal.remove();
        };
        document.getElementById('donate-close').addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    }

    showHowToPlay() {
        const modal = document.createElement('div');
        modal.className = 'how-to-play-modal';
        modal.innerHTML = `
            <div class="how-to-play-content">
                <h2>How To Play</h2>
                <div class="controls-grid">
                    <div class="player-controls">
                        <h3><span class="p1-color">■</span> Player 1</h3>
                        <div class="key-row"><span>Move</span><span class="key-badge">W A S D</span></div>
                        <div class="key-row"><span>Place Bomb</span><span class="key-badge">SPACE</span></div>
                    </div>
                    <div class="player-controls">
                        <h3><span class="p2-color">■</span> Player 2</h3>
                        <div class="key-row"><span>Move</span><span class="key-badge">↑ ← ↓ →</span></div>
                        <div class="key-row"><span>Place Bomb</span><span class="key-badge">ENTER</span></div>
                    </div>
                </div>
                <div class="tips-section">
                    <h3>Power-Ups</h3>
                    <ul>
                        <li><span style="color:#ff6600">▲</span> Fire Up — Increases bomb explosion range</li>
                        <li><span style="color:#666">●</span> Bomb Up — Carry more bombs at once</li>
                        <li><span style="color:#ffff00">◆</span> Speed Up — Move faster</li>
                    </ul>
                </div>
                <div class="tips-section">
                    <h3>Tips</h3>
                    <ul>
                        <li>Destroy blocks to find power-ups</li>
                        <li>Bombs can chain-detonate each other!</li>
                        <li>Don't trap yourself with your own bombs</li>
                        <li>First to win 3 rounds wins the match</li>
                    </ul>
                </div>
                <button class="menu-btn" id="howto-close" style="margin:0 auto;display:block;">GOT IT</button>
            </div>
        `;
        this.container.appendChild(modal);

        const close = () => modal.remove();
        document.getElementById('howto-close').addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}
