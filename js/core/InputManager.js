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
        this.prevKeys = {};

        window.addEventListener('keydown', (e) => {
            if (GAME_KEYS.has(e.code)) {
                e.preventDefault();
            }
            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    update() {
        this.prevKeys = { ...this.keys };
    }

    isKeyDown(code) {
        return !!this.keys[code];
    }

    wasKeyPressed(code) {
        return !!this.keys[code] && !this.prevKeys[code];
    }

    reset() {
        this.keys = {};
        this.prevKeys = {};
    }
}
