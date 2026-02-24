import { Game } from './Game.js';

const game = new Game();
window._game = game;
game.init();

const clock = new THREE.Clock();

function gameLoop() {
    requestAnimationFrame(gameLoop);
    const delta = Math.min(clock.getDelta(), 0.05); // cap delta to prevent spiral
    game.update(delta);
    game.render();
}

gameLoop();
