// Virtual input adapter that mimics InputManager interface.
// AI brain sets virtual key states; Player.update() reads them identically to real keyboard input.

export class AIInput {
    constructor() {
        this._keys = {
            UP: false,
            DOWN: false,
            LEFT: false,
            RIGHT: false,
            BOMB: false,
        };
        this._pressedThisFrame = new Set();
        this._prevPressed = new Set();
    }

    // Called at start of each frame — cycles press state (same pattern as InputManager)
    update() {
        this._prevPressed = new Set(this._pressedThisFrame);
        this._pressedThisFrame.clear();
    }

    // Same interface as InputManager
    isKeyDown(code) {
        return !!this._keys[code];
    }

    // True only on the frame the key was first pressed
    wasKeyPressed(code) {
        return this._prevPressed.has(code);
    }

    // Called by AI brain to set movement direction
    setDirection(dx, dz) {
        this._keys.LEFT = dx < 0;
        this._keys.RIGHT = dx > 0;
        this._keys.UP = dz < 0;
        this._keys.DOWN = dz > 0;
    }

    // Called by AI brain to trigger bomb placement
    setBomb(shouldPlace) {
        if (shouldPlace && !this._keys.BOMB) {
            this._pressedThisFrame.add('BOMB');
        }
        this._keys.BOMB = shouldPlace;
    }

    // Clear all state
    reset() {
        this._keys.UP = false;
        this._keys.DOWN = false;
        this._keys.LEFT = false;
        this._keys.RIGHT = false;
        this._keys.BOMB = false;
        this._pressedThisFrame.clear();
        this._prevPressed.clear();
    }

    // Clear movement only (useful between decisions)
    clearMovement() {
        this._keys.UP = false;
        this._keys.DOWN = false;
        this._keys.LEFT = false;
        this._keys.RIGHT = false;
    }
}
