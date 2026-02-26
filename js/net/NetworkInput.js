// Virtual input adapter for remote players — mirrors AIInput interface exactly.
// Host uses this to feed the remote client's inputs into Player.update().

export class NetworkInput {
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

    // Called at start of each frame — cycles press state (same pattern as AIInput)
    update() {
        this._prevPressed = new Set(this._pressedThisFrame);
        this._pressedThisFrame.clear();
    }

    // Same interface as InputManager / AIInput
    isKeyDown(code) {
        return !!this._keys[code];
    }

    // True only on the frame the key was first pressed
    wasKeyPressed(code) {
        return this._prevPressed.has(code);
    }

    // Called when a network input message arrives from the remote client.
    // inputState = { keys: { UP, DOWN, LEFT, RIGHT, BOMB }, pressed: ['BOMB'] }
    applyRemoteInput(inputState) {
        this._keys.UP = !!inputState.keys.UP;
        this._keys.DOWN = !!inputState.keys.DOWN;
        this._keys.LEFT = !!inputState.keys.LEFT;
        this._keys.RIGHT = !!inputState.keys.RIGHT;
        this._keys.BOMB = !!inputState.keys.BOMB;

        // Record newly-pressed keys so wasKeyPressed fires on next update()
        for (const key of (inputState.pressed || [])) {
            this._pressedThisFrame.add(key);
        }
    }

    reset() {
        this._keys.UP = false;
        this._keys.DOWN = false;
        this._keys.LEFT = false;
        this._keys.RIGHT = false;
        this._keys.BOMB = false;
        this._pressedThisFrame.clear();
        this._prevPressed.clear();
    }
}
