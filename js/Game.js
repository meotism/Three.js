import { SceneManager } from './scenes/SceneManager.js';
import { InputManager, P1_KEYS, P2_KEYS } from './core/InputManager.js';
import { AudioManager } from './core/AudioManager.js';
import { MAP_DEFINITIONS } from './map/MapData.js';
import { GridSystem } from './map/GridSystem.js';
import { MapLoader } from './map/MapLoader.js';
import { Player } from './entities/Player.js';
import { Bomb } from './entities/Bomb.js';
import { Explosion } from './entities/Explosion.js';
import { PowerUp, DROP_CHANCE } from './entities/PowerUp.js';
import { ParticleSystem } from './effects/ParticleSystem.js';
import { ShakeEffect } from './effects/ShakeEffect.js';
import { MenuUI } from './ui/MenuUI.js';
import { MapSelectUI } from './ui/MapSelectUI.js';
import { HUD } from './ui/HUD.js';
import { RoundOverUI } from './ui/RoundOverUI.js';

const STATES = {
    MENU: 'MENU',
    MAP_SELECT: 'MAP_SELECT',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING: 'PLAYING',
    ROUND_OVER: 'ROUND_OVER',
    GAME_OVER: 'GAME_OVER',
};

const MAX_ROUNDS = 5;
const WINS_NEEDED = 3;

export class Game {
    constructor() {
        this.sceneManager = new SceneManager();
        this.input = new InputManager();
        this.audio = new AudioManager();
        this.uiContainer = document.getElementById('ui-layer');

        this.menuUI = new MenuUI(this.uiContainer);
        this.mapSelectUI = new MapSelectUI(this.uiContainer);
        this.hud = new HUD(this.uiContainer);
        this.roundOverUI = new RoundOverUI(this.uiContainer);

        this.particles = new ParticleSystem(this.sceneManager.scene);
        this.shakeEffect = new ShakeEffect(this.sceneManager.camera);

        this.mapLoader = new MapLoader(this.sceneManager.scene);

        this.state = null;

        // Game state
        this.selectedMapIndex = 0;
        this.currentRound = 0;
        this.p1Score = 0;
        this.p2Score = 0;

        // Entities
        this.player1 = null;
        this.player2 = null;
        this.bombs = [];
        this.explosions = [];
        this.powerUps = [];
        this.blocks = [];
        this.gridSystem = null;

        // Countdown
        this.countdownTimer = 0;
        this.countdownElement = null;

        // Menu animation
        this.menuTime = 0;

        // Round end delay
        this.roundEndDelay = 0;
    }

    init() {
        // Initialize audio on first user interaction
        const initAudio = () => {
            this.audio.init();
            window.removeEventListener('click', initAudio);
            window.removeEventListener('keydown', initAudio);
        };
        window.addEventListener('click', initAudio);
        window.addEventListener('keydown', initAudio);

        this.setState(STATES.MENU);
    }

    setState(newState) {
        // Cleanup previous state
        this.cleanupState();
        this.state = newState;

        switch (newState) {
            case STATES.MENU:
                this.setupMenu();
                break;
            case STATES.MAP_SELECT:
                this.setupMapSelect();
                break;
            case STATES.COUNTDOWN:
                this.setupCountdown();
                break;
            case STATES.PLAYING:
                // Already set up during countdown
                break;
            case STATES.ROUND_OVER:
                this.setupRoundOver();
                break;
            case STATES.GAME_OVER:
                this.setupGameOver();
                break;
        }
    }

    cleanupState() {
        this.menuUI.hide();
        this.mapSelectUI.hide();
        this.hud.hide();
        this.roundOverUI.hide();
        if (this.countdownElement) {
            this.countdownElement.remove();
            this.countdownElement = null;
        }
    }

    // ============ MENU ============
    setupMenu() {
        this.p1Score = 0;
        this.p2Score = 0;
        this.currentRound = 0;

        this.sceneManager.clearScene();
        this.setupMenuBackground();
        this.sceneManager.positionCameraForMenu();

        this.menuUI.show();
        this.menuUI.onStart = () => {
            this.audio.init();
            this.audio.play('menu_select');
            this.setState(STATES.MAP_SELECT);
        };
    }

    setupMenuBackground() {
        // Simple animated background
        const scene = this.sceneManager.scene;
        scene.background = new THREE.Color(0x0a0a1a);

        // Floor
        const floorGeo = new THREE.PlaneGeometry(20, 20);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.9 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(6, 0, 5);
        floor.receiveShadow = true;
        scene.add(floor);

        // Some decorative blocks
        const colors = [0xff4500, 0xff8c00, 0xffd700, 0x42a5f5, 0xef5350];
        for (let i = 0; i < 15; i++) {
            const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const mat = new THREE.MeshStandardMaterial({
                color: colors[i % colors.length],
                roughness: 0.5,
                metalness: 0.3,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                Math.random() * 12,
                0.4,
                Math.random() * 10
            );
            mesh.castShadow = true;
            mesh.userData.menuBlock = true;
            mesh.userData.rotSpeed = (Math.random() - 0.5) * 2;
            scene.add(mesh);
        }
    }

    // ============ MAP SELECT ============
    setupMapSelect() {
        this.mapSelectUI.show();
        this.mapSelectUI.onSelect = (index) => {
            this.audio.play('menu_select');
            this.selectedMapIndex = index;
            this.currentRound = 0;
            this.p1Score = 0;
            this.p2Score = 0;
            this.startNewRound();
        };
        this.mapSelectUI.onBack = () => {
            this.audio.play('menu_select');
            this.setState(STATES.MENU);
        };
    }

    // ============ ROUND SETUP ============
    startNewRound() {
        this.currentRound++;

        // Clear everything
        this.sceneManager.clearScene();
        this.bombs.forEach(b => b.dispose());
        this.bombs = [];
        this.explosions.forEach(e => e.dispose());
        this.explosions = [];
        this.powerUps.forEach(p => p.dispose());
        this.powerUps = [];
        this.particles.clear();
        this.shakeEffect.reset();

        // Load map
        const mapDef = MAP_DEFINITIONS[this.selectedMapIndex];
        const { walls, blocks } = this.mapLoader.load(mapDef);
        this.blocks = blocks;
        this.gridSystem = new GridSystem(mapDef.grid, mapDef.cols, mapDef.rows);

        // Position camera
        this.sceneManager.positionCameraForMap(mapDef.cols, mapDef.rows);

        // Spawn players
        const spawns = GridSystem.getSpawnPositions(mapDef);

        if (!this.player1) {
            this.player1 = new Player(1, 0x42a5f5, P1_KEYS);
            this.player2 = new Player(2, 0xef5350, P2_KEYS);
        }

        this.player1.spawn(spawns.p1.x, spawns.p1.z);
        this.player2.spawn(spawns.p2.x, spawns.p2.z);

        this.sceneManager.scene.add(this.player1.model);
        this.sceneManager.scene.add(this.player2.model);

        this.roundEndDelay = 0;
        this.setState(STATES.COUNTDOWN);
    }

    // ============ COUNTDOWN ============
    setupCountdown() {
        this.countdownTimer = 3.5;
        this.countdownElement = document.createElement('div');
        this.countdownElement.className = 'countdown-overlay';
        this.uiContainer.appendChild(this.countdownElement);

        this.hud.show(this.currentRound, MAX_ROUNDS, this.p1Score, this.p2Score);
        this.hud.update(this.player1, this.player2);
    }

    updateCountdown(delta) {
        this.countdownTimer -= delta;
        const num = Math.ceil(this.countdownTimer);

        if (num > 0 && num <= 3) {
            this.countdownElement.innerHTML = `<div class="countdown-number">${num}</div>`;
            if (this.countdownTimer + delta >= num && this.countdownTimer < num) {
                this.audio.play('countdown');
            }
        } else if (num <= 0) {
            this.countdownElement.innerHTML = `<div class="countdown-go">GO!</div>`;
            if (this.countdownTimer + delta >= 0 && this.countdownTimer < 0) {
                this.audio.play('go');
            }
        }

        if (this.countdownTimer <= -0.6) {
            this.setState(STATES.PLAYING);
            this.hud.show(this.currentRound, MAX_ROUNDS, this.p1Score, this.p2Score);
        }
    }

    // ============ PLAYING ============
    updatePlaying(delta) {
        // Update players
        const bombAction1 = this.player1.update(delta, this.input, this.gridSystem);
        const bombAction2 = this.player2.update(delta, this.input, this.gridSystem);

        // Handle bomb placement
        if (bombAction1) this.placeBomb(this.player1, bombAction1.gridX, bombAction1.gridZ);
        if (bombAction2) this.placeBomb(this.player2, bombAction2.gridX, bombAction2.gridZ);

        // Update bombs
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const bomb = this.bombs[i];
            const shouldExplode = bomb.update(delta);
            if (shouldExplode && !bomb.detonated) {
                this.detonateBomb(bomb);
            }
        }

        // Process detonation queue
        this.processDetonationQueue();

        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            if (exp.update(delta)) {
                exp.dispose();
                this.explosions.splice(i, 1);
            }
        }

        // Update blocks (destruction animation)
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            if (block.update(delta)) {
                block.dispose();
                this.blocks.splice(i, 1);
            }
        }

        // Update power-ups
        for (const pu of this.powerUps) {
            pu.update(delta);
        }

        // Check player-powerup collisions
        this.checkPowerUpPickup(this.player1);
        this.checkPowerUpPickup(this.player2);

        // Check player-explosion collisions
        this.checkExplosionDamage(this.player1);
        this.checkExplosionDamage(this.player2);

        // Update particles
        this.particles.update(delta);

        // Update camera shake
        this.shakeEffect.update(delta);

        // Update HUD
        this.hud.update(this.player1, this.player2);

        // Check round end
        this.checkRoundEnd(delta);
    }

    placeBomb(player, gridX, gridZ) {
        // Check if there's already a bomb here
        if (this.gridSystem.getCell(gridX, gridZ) !== 0) return;

        const bomb = new Bomb(gridX, gridZ, player.bombRange, player.id);
        this.bombs.push(bomb);
        this.sceneManager.scene.add(bomb.model);
        this.gridSystem.placeBomb(gridX, gridZ, bomb);
        player.activeBombs++;
        this.audio.play('bomb_place');
    }

    detonateBomb(bomb) {
        if (bomb.detonated) return;
        bomb.detonate();

        // Remove from grid
        this.gridSystem.removeBomb(bomb.gridX, bomb.gridZ);

        // Notify owner
        const owner = bomb.ownerId === 1 ? this.player1 : this.player2;
        owner.onBombExploded();

        // Create explosion
        const explosion = new Explosion(bomb.gridX, bomb.gridZ, bomb.range, this.gridSystem);
        this.explosions.push(explosion);
        this.sceneManager.scene.add(explosion.group);

        // Handle destroyed blocks
        for (const pos of explosion.destroyedBlocks) {
            this.gridSystem.destroyBlock(pos.x, pos.z);
            const block = this.blocks.find(b => b.gridX === pos.x && b.gridZ === pos.z && b.alive);
            if (block) {
                block.destroy();
                this.particles.emit(pos.x, 0.4, pos.z, 10, 0x8B4513);
                // Power-up drop
                if (Math.random() < DROP_CHANCE) {
                    const pu = new PowerUp(pos.x, pos.z, PowerUp.randomType());
                    this.powerUps.push(pu);
                    this.sceneManager.scene.add(pu.model);
                }
            }
        }

        // Queue chain detonations
        this._detonationQueue = this._detonationQueue || [];
        for (const pos of explosion.chainBombs) {
            const chainBomb = this.gridSystem.getBombAt(pos.x, pos.z);
            if (chainBomb && !chainBomb.detonated) {
                this._detonationQueue.push(chainBomb);
            }
        }

        // Effects
        this.particles.emit(bomb.gridX, 0.3, bomb.gridZ, 25, 0xff4500);
        this.shakeEffect.shake(0.12);
        this.audio.play('explosion');

        // Remove bomb mesh
        bomb.dispose();
        const idx = this.bombs.indexOf(bomb);
        if (idx !== -1) this.bombs.splice(idx, 1);
    }

    processDetonationQueue() {
        if (!this._detonationQueue) return;
        while (this._detonationQueue.length > 0) {
            const bomb = this._detonationQueue.shift();
            if (!bomb.detonated) {
                this.detonateBomb(bomb);
            }
        }
    }

    checkPowerUpPickup(player) {
        if (!player.alive) return;
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const pu = this.powerUps[i];
            if (!pu.collected && pu.gridX === player.gridX && pu.gridZ === player.gridZ) {
                player.applyPowerUp(pu.type.id);
                pu.collect();
                pu.dispose();
                this.powerUps.splice(i, 1);
                this.audio.play('powerup');
            }
        }
    }

    checkExplosionDamage(player) {
        if (!player.alive) return;
        for (const exp of this.explosions) {
            if (exp.hitsCell(player.gridX, player.gridZ)) {
                player.die();
                this.audio.play('player_death');
                this.particles.emit(player.model.position.x, 0.5, player.model.position.z, 15, player.color);
                break;
            }
        }
    }

    checkRoundEnd(delta) {
        if (!this.player1.alive && !this.player2.alive) {
            // Both dead — draw, no score change
            this.roundEndDelay += delta;
            if (this.roundEndDelay > 1.5) {
                this.setState(STATES.ROUND_OVER);
                this._roundWinner = 0;
            }
        } else if (!this.player1.alive) {
            this.roundEndDelay += delta;
            if (this.roundEndDelay > 1.5) {
                this.p2Score++;
                this._roundWinner = 2;
                this.checkGameOver();
            }
        } else if (!this.player2.alive) {
            this.roundEndDelay += delta;
            if (this.roundEndDelay > 1.5) {
                this.p1Score++;
                this._roundWinner = 1;
                this.checkGameOver();
            }
        }
    }

    checkGameOver() {
        if (this.p1Score >= WINS_NEEDED) {
            this.setState(STATES.GAME_OVER);
        } else if (this.p2Score >= WINS_NEEDED) {
            this.setState(STATES.GAME_OVER);
        } else {
            this.setState(STATES.ROUND_OVER);
        }
    }

    // ============ ROUND OVER ============
    setupRoundOver() {
        this.roundOverUI.showRoundOver(
            this._roundWinner || 0,
            this.p1Score,
            this.p2Score,
            this.currentRound,
            MAX_ROUNDS
        );
        this.roundOverUI.onNextRound = () => {
            this.audio.play('menu_select');
            this.startNewRound();
        };
    }

    // ============ GAME OVER ============
    setupGameOver() {
        const winner = this.p1Score >= WINS_NEEDED ? 1 : 2;
        this.audio.play('win');
        this.roundOverUI.showGameOver(winner, this.p1Score, this.p2Score);
        this.roundOverUI.onRematch = () => {
            this.audio.play('menu_select');
            this.p1Score = 0;
            this.p2Score = 0;
            this.currentRound = 0;
            this.startNewRound();
        };
        this.roundOverUI.onMenu = () => {
            this.audio.play('menu_select');
            this.setState(STATES.MENU);
        };
    }

    // ============ UPDATE & RENDER ============
    update(delta) {
        this.input.update();

        switch (this.state) {
            case STATES.MENU:
                this.updateMenu(delta);
                break;
            case STATES.COUNTDOWN:
                this.updateCountdown(delta);
                break;
            case STATES.PLAYING:
                this.updatePlaying(delta);
                break;
        }
    }

    updateMenu(delta) {
        this.menuTime += delta;
        // Rotate menu blocks
        this.sceneManager.scene.traverse((child) => {
            if (child.userData.menuBlock) {
                child.rotation.y += child.userData.rotSpeed * delta;
                child.position.y = 0.4 + Math.sin(this.menuTime * 1.5 + child.position.x) * 0.15;
            }
        });
    }

    render() {
        this.sceneManager.render();
    }
}
