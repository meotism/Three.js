export function isMobileDevice() {
    return ('ontouchstart' in window || navigator.maxTouchPoints > 0)
        && window.matchMedia('(pointer: coarse)').matches;
}

export class TouchControls {
    constructor() {
        this._keys = { UP: false, DOWN: false, LEFT: false, RIGHT: false, BOMB: false };
        this._pressedThisFrame = new Set();
        this._prevPressed = new Set();
        this.element = null;
    }

    // InputManager-compatible interface (uses semantic keys: UP/DOWN/LEFT/RIGHT/BOMB)
    update() {
        this._prevPressed = new Set(this._pressedThisFrame);
        this._pressedThisFrame.clear();
    }

    isKeyDown(code) {
        return !!this._keys[code];
    }

    wasKeyPressed(code) {
        return this._prevPressed.has(code);
    }

    reset() {
        Object.keys(this._keys).forEach(k => this._keys[k] = false);
        this._pressedThisFrame.clear();
        this._prevPressed.clear();
    }

    show(container) {
        if (this.element) return;

        this.element = document.createElement('div');
        this.element.className = 'touch-controls';
        this.element.innerHTML = `
            <div class="touch-dpad">
                <button class="touch-btn touch-up"    data-key="UP">▲</button>
                <button class="touch-btn touch-left"  data-key="LEFT">◀</button>
                <div class="touch-center"></div>
                <button class="touch-btn touch-right" data-key="RIGHT">▶</button>
                <button class="touch-btn touch-down"  data-key="DOWN">▼</button>
            </div>
            <button class="touch-btn touch-bomb" data-key="BOMB">💣</button>
        `;
        container.appendChild(this.element);
        this._bindEvents();
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        this.reset();
    }

    _pressButton(key) {
        if (!this._keys[key]) {
            this._pressedThisFrame.add(key);
        }
        this._keys[key] = true;
    }

    _releaseButton(key) {
        this._keys[key] = false;
    }

    _bindEvents() {
        this.element.querySelectorAll('[data-key]').forEach(btn => {
            const key = btn.dataset.key;

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this._pressButton(key);
                btn.classList.add('pressed');
            }, { passive: false });

            btn.addEventListener('touchend', () => {
                this._releaseButton(key);
                btn.classList.remove('pressed');
            });

            btn.addEventListener('touchcancel', () => {
                this._releaseButton(key);
                btn.classList.remove('pressed');
            });
        });
    }
}
