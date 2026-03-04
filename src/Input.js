/**
 * InputHandler - Keyboard input state tracker
 * Maps arrow keys + WASD to normalized input axes
 */
export default class InputHandler {
    constructor() {
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            space: false,
        };

        window.addEventListener('keydown', (e) => this._handle(e, true));
        window.addEventListener('keyup', (e) => this._handle(e, false));
    }

    _handle(e, pressed) {
        // Prevent page scrolling from arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
        switch (e.code) {
            case 'ArrowUp': case 'KeyW': this.keys.up = pressed; break;
            case 'ArrowDown': case 'KeyS': this.keys.down = pressed; break;
            case 'ArrowLeft': case 'KeyA': this.keys.left = pressed; break;
            case 'ArrowRight': case 'KeyD': this.keys.right = pressed; break;
            case 'Space': this.keys.space = pressed; break;
        }
    }
}
