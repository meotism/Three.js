export const P1_KEYS = {
    UP: 'KeyW',
    DOWN: 'KeyS',
    LEFT: 'KeyA',
    RIGHT: 'KeyD',
    BOMB: 'Space',
};

export const P2_KEYS = {
    UP: 'ArrowUp',
    DOWN: 'ArrowDown',
    LEFT: 'ArrowLeft',
    RIGHT: 'ArrowRight',
    BOMB: 'Enter',
};

const GAME_KEYS = new Set([
    ...Object.values(P1_KEYS),
    ...Object.values(P2_KEYS),
]);

export class InputManager {
    constructor() {
        this.keys = {};
        // Track keys pressed between frames (only first press, not held)
        this._pressedThisFrame = new Set();
        this._prevPressed = new Set();

        window.addEventListener('keydown', (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (GAME_KEYS.has(e.code)) {
                e.preventDefault();
            }
            if (!this.keys[e.code]) {
                // Only record the first keydown (not auto-repeat)
                this._pressedThisFrame.add(e.code);
            }
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    // Called at start of each frame — moves pressed set forward
    update() {
        this._prevPressed = new Set(this._pressedThisFrame);
        this._pressedThisFrame.clear();
    }

    isKeyDown(code) {
        return !!this.keys[code];
    }

    // True only on the frame the key was first pressed (not held)
    wasKeyPressed(code) {
        return this._prevPressed.has(code);
    }

    reset() {
        this.keys = {};
        this._pressedThisFrame.clear();
        this._prevPressed.clear();
    }
}
