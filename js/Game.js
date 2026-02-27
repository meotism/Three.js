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
import { ModeSelectUI } from './ui/ModeSelectUI.js';
import { MapSelectUI } from './ui/MapSelectUI.js';
import { HUD } from './ui/HUD.js';
import { RoundOverUI } from './ui/RoundOverUI.js';
import { AIInput } from './ai/AIInput.js';
import { AIBrain } from './ai/AIBrain.js';
import { TouchControls, isMobileDevice } from './ui/TouchControls.js';
import { RoomManager } from './net/RoomManager.js';
import { GameSync } from './net/GameSync.js';
import { NetworkInput } from './net/NetworkInput.js';
import { OnlineLobbyUI } from './ui/OnlineLobbyUI.js';

const STATES = {
    MENU: 'MENU',
    MODE_SELECT: 'MODE_SELECT',
    MAP_SELECT: 'MAP_SELECT',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING: 'PLAYING',
    ROUND_OVER: 'ROUND_OVER',
    GAME_OVER: 'GAME_OVER',
    ONLINE_LOBBY: 'ONLINE_LOBBY',
};

const MAX_ROUNDS = 5;
const WINS_NEEDED = 3;

const AI_KEYS = { UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT', BOMB: 'BOMB' };
const PLAYER_COLORS = [0x42a5f5, 0xef5350, 0x66bb6a, 0xffa726];
const SPAWN_KEYS = ['p1', 'p2', 'p3', 'p4'];

export class Game {
    constructor() {
        this.sceneManager = new SceneManager();
        this.input = new InputManager();
        this._isMobile = isMobileDevice();
        this.touchControls = this._isMobile ? new TouchControls() : null;
        if (this._isMobile) {
            this.sceneManager.camera.fov = 60;
            this.sceneManager.camera.updateProjectionMatrix();
        }
        this.audio = new AudioManager();
        this.uiContainer = document.getElementById('ui-layer');

        this.menuUI = new MenuUI(this.uiContainer);
        this.modeSelectUI = new ModeSelectUI(this.uiContainer);
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
        this.gameMode = null; // 'single' or 'double'
        this.scores = [0, 0, 0, 0];

        // Players: array of { player, isNPC, brain, aiInput }
        this.players = [];

        // Entities
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

        // Online multiplayer
        this.isOnline = false;
        this.isHost = false;
        this.isClient = false;
        this.roomManager = null;
        this.gameSync = new GameSync();
        this.networkInputs = new Map(); // playerId → NetworkInput
        this.onlineLobbyUI = new OnlineLobbyUI(this.uiContainer);
        this._lastSentInput = null;
        this.onlineHumanCount = 2; // how many online human players (set at game start)

        // HUD throttle
        this._hudUpdateTimer = 0;
        this._hudUpdateInterval = 0.25; // max 4 updates/sec
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
            case STATES.MODE_SELECT:
                this.setupModeSelect();
                break;
            case STATES.MAP_SELECT:
                this.setupMapSelect();
                break;
            case STATES.COUNTDOWN:
                this.setupCountdown();
                break;
            case STATES.PLAYING:
                // Already set up during countdown
                if (this.touchControls) this.touchControls.show(this.uiContainer);
                break;
            case STATES.ROUND_OVER:
                this.setupRoundOver();
                break;
            case STATES.GAME_OVER:
                this.setupGameOver();
                break;
            case STATES.ONLINE_LOBBY:
                this.setupOnlineLobby();
                break;
        }
    }

    cleanupState() {
        this.menuUI.hide();
        this.modeSelectUI.hide();
        this.mapSelectUI.hide();
        this.hud.hide();
        this.roundOverUI.hide();
        this.onlineLobbyUI.hide();
        if (this.countdownElement) {
            this.countdownElement.remove();
            this.countdownElement = null;
        }
        if (this.touchControls) this.touchControls.hide();
    }

    // ============ MENU ============
    setupMenu() {
        this._cleanupOnline();
        this.scores = [0, 0, 0, 0];
        this.currentRound = 0;
        this.players = [];

        this.sceneManager.clearScene();
        this.setupMenuBackground();
        this.sceneManager.positionCameraForMenu();

        this.menuUI.show();
        this.menuUI.onStart = () => {
            this.audio.init();
            this.audio.play('menu_select');
            this.setState(STATES.MODE_SELECT);
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

    // ============ MODE SELECT ============
    setupModeSelect() {
        this.modeSelectUI.show(this._isMobile);
        this.modeSelectUI.onSelectSingle = () => {
            this.audio.play('menu_select');
            this.gameMode = 'single';
            this.setState(STATES.MAP_SELECT);
        };
        this.modeSelectUI.onSelectDouble = () => {
            this.audio.play('menu_select');
            this.gameMode = 'double';
            this.setState(STATES.MAP_SELECT);
        };
        this.modeSelectUI.onSelectOnline = () => {
            this.audio.play('menu_select');
            this.gameMode = 'online';
            this.setState(STATES.ONLINE_LOBBY);
        };
        this.modeSelectUI.onBack = () => {
            this.audio.play('menu_select');
            this.setState(STATES.MENU);
        };
    }

    // ============ MAP SELECT ============
    setupMapSelect() {
        this.mapSelectUI.show();
        this.mapSelectUI.onSelect = (index) => {
            this.audio.play('menu_select');
            this.selectedMapIndex = index;
            this.currentRound = 0;
            this.scores = [0, 0, 0, 0];
            // Notify clients of map selection + human count
            if (this.isOnline && this.isHost && this.roomManager) {
                this.roomManager.broadcastMapSelected(index, this.onlineHumanCount);
            }
            this.startNewRound();
        };
        this.mapSelectUI.onBack = () => {
            this.audio.play('menu_select');
            if (this.isOnline) {
                this._cleanupOnline();
            }
            this.setState(STATES.MODE_SELECT);
        };
    }

    // ============ ROUND SETUP ============
    startNewRound() {
        this.currentRound++;
        // Reset grid delta tracking so client gets fresh full grid
        if (this.gameSync) this.gameSync.resetGridDelta();

        // Remove player models from scene BEFORE clearScene() to prevent disposal
        for (const entry of this.players) {
            if (entry.player.model.parent) {
                entry.player.model.parent.remove(entry.player.model);
            }
        }

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

        // Spawn positions
        const spawns = GridSystem.getSpawnPositions(mapDef);
        const humanCount = this.isOnline ? this.onlineHumanCount : (this.gameMode === 'single' ? 1 : 2);
        const KEY_SETS = [P1_KEYS, P2_KEYS];

        // Setup NetworkInputs for remote players (host only)
        if (this.isOnline && this.isHost) {
            this.networkInputs.clear();
            for (let id = 2; id <= humanCount; id++) {
                this.networkInputs.set(id, new NetworkInput());
            }
        }

        // Create players on first round, reuse on subsequent
        if (this.players.length === 0) {
            for (let i = 0; i < 4; i++) {
                let isNPC, keys;
                const playerId = i + 1;

                if (this.isOnline) {
                    // Online: players up to humanCount are human, rest are AI
                    isNPC = playerId > humanCount;
                    // Remote human players use generic keys (fed by NetworkInput on host)
                    keys = isNPC ? AI_KEYS
                        : (playerId >= 2) ? AI_KEYS  // remote humans use generic keys
                        : (this._isMobile && playerId === 1) ? AI_KEYS
                        : P1_KEYS;
                } else {
                    isNPC = i >= humanCount;
                    keys = isNPC ? AI_KEYS
                        : (this._isMobile && i === 0) ? AI_KEYS
                        : KEY_SETS[i];
                }

                const player = new Player(playerId, PLAYER_COLORS[i], keys);
                const brain = isNPC ? new AIBrain(playerId) : null;
                const aiInput = brain ? brain.aiInput : null;
                this.players.push({ player, isNPC, brain, aiInput });
            }
        }

        // Spawn all players
        for (let i = 0; i < 4; i++) {
            const spawn = spawns[SPAWN_KEYS[i]];
            this.players[i].player.spawn(spawn.x, spawn.z);
            this.sceneManager.scene.add(this.players[i].player.model);
        }

        this.roundEndDelay = 0;
        this.setState(STATES.COUNTDOWN);
    }

    // ============ COUNTDOWN ============
    setupCountdown() {
        this.countdownTimer = 3.5;
        this.lastCountdownNum = -1;
        this.countdownElement = document.createElement('div');
        this.countdownElement.className = 'countdown-overlay';
        this.uiContainer.appendChild(this.countdownElement);

        this.hud.show(this.currentRound, MAX_ROUNDS, this.scores, this.players);
        this.hud.updateStats(this.players);
    }

    updateCountdown(delta) {
        this.countdownTimer -= delta;
        const num = Math.ceil(this.countdownTimer);

        if (num > 0 && num <= 3) {
            if (num !== this.lastCountdownNum) {
                this.lastCountdownNum = num;
                this.countdownElement.innerHTML = `<div class="countdown-number">${num}</div>`;
                this.audio.play('countdown');
            }
        } else if (num <= 0) {
            if (this.lastCountdownNum !== 0) {
                this.lastCountdownNum = 0;
                this.countdownElement.innerHTML = `<div class="countdown-go">GO!</div>`;
                this.audio.play('go');
            }
        }

        if (this.countdownTimer <= -0.6) {
            this.setState(STATES.PLAYING);
            this.hud.show(this.currentRound, MAX_ROUNDS, this.scores, this.players);
        }
    }

    // ============ PLAYING ============
    updatePlaying(delta) {
        // CLIENT: Don't run game logic. State is received from host via GameSync.
        if (this.isOnline && this.isClient) {
            this._updateClientVisuals(delta);
            return;
        }

        // Compute shared danger map once for all AI bots (optimization)
        const allPlayers = this.players.map(e => e.player);
        let sharedDangerMap = null;
        for (const entry of this.players) {
            if (entry.isNPC && entry.player.alive && entry.brain) {
                if (!sharedDangerMap) {
                    sharedDangerMap = entry.brain.dangerMap;
                    sharedDangerMap.compute(this.gridSystem, this.bombs, this.explosions);
                }
                entry.brain.update(delta, entry.player, allPlayers,
                    this.gridSystem, this.bombs, this.explosions, this.powerUps, this.blocks, sharedDangerMap);
            }
        }

        // Update all players
        for (const entry of this.players) {
            let inputSource;
            if (this.isOnline && this.isHost && this.networkInputs.has(entry.player.id)) {
                // Remote player on host — use their NetworkInput
                inputSource = this.networkInputs.get(entry.player.id);
            } else if (entry.isNPC) {
                inputSource = entry.aiInput;
            } else if (this._isMobile && entry.player.id === 1) {
                inputSource = this.touchControls;
            } else {
                inputSource = this.input;
            }
            const bombAction = entry.player.update(delta, inputSource, this.gridSystem);
            if (bombAction) this.placeBomb(entry.player, bombAction.gridX, bombAction.gridZ);
        }

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

        // Check collisions for all players
        for (const entry of this.players) {
            this.checkPowerUpPickup(entry.player);
            this.checkExplosionDamage(entry.player);
        }

        // Update particles
        this.particles.update(delta);

        // Update camera shake
        if (this._isMobile) this._updateMobileCamera();
        this.shakeEffect.update(delta);

        // Update HUD (throttled)
        this._hudUpdateTimer += delta;
        if (this._hudUpdateTimer >= this._hudUpdateInterval) {
            this._hudUpdateTimer = 0;
            this.hud.updateStats(this.players);
        }

        // Check round end
        this.checkRoundEnd(delta);

        // HOST: broadcast game state to client
        if (this.isOnline && this.isHost && this.roomManager) {
            this.gameSync.tickHost(delta, this, this.roomManager);
        }
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
        const ownerEntry = this.players.find(e => e.player.id === bomb.ownerId);
        if (ownerEntry) ownerEntry.player.onBombExploded();

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
        const alivePlayers = this.players.filter(e => e.player.alive);
        // In online mode, "humans" = all online players (ids 1 to humanCount)
        const aliveHumans = this.isOnline
            ? this.players.filter(e => e.player.id <= this.onlineHumanCount && e.player.alive)
            : this.players.filter(e => !e.isNPC && e.player.alive);

        // Round ends when: <=1 player alive OR all human players are dead
        const shouldEnd = alivePlayers.length <= 1 || aliveHumans.length === 0;

        if (shouldEnd) {
            this.roundEndDelay += delta;
            if (this.roundEndDelay > 1.5) {
                if (alivePlayers.length >= 1) {
                    // Last standing player (or strongest surviving bot) wins
                    const winnerId = alivePlayers[0].player.id;
                    this.scores[winnerId - 1]++;
                    this._roundWinner = winnerId;
                } else {
                    this._roundWinner = 0; // draw
                }
                this.checkGameOver();
            }
        }
    }

    checkGameOver() {
        const maxScore = Math.max(...this.scores);
        if (maxScore >= WINS_NEEDED) {
            this.setState(STATES.GAME_OVER);
        } else {
            this.setState(STATES.ROUND_OVER);
        }
    }

    // ============ ROUND OVER ============
    setupRoundOver() {
        // Broadcast round result to client
        if (this.isOnline && this.isHost && this.roomManager) {
            this.roomManager.broadcastGameEvent({
                type: 'round_over',
                winnerId: this._roundWinner || 0,
                scores: this.scores,
            });
        }

        this.roundOverUI.showRoundOver(
            this._roundWinner || 0,
            this.scores,
            this.currentRound,
            MAX_ROUNDS
        );

        if (this.isOnline && this.isClient) {
            // Client: hide button, show waiting for host
            this.roundOverUI.showWaitingOverlay();
        } else {
            this.roundOverUI.onNextRound = () => {
                this.audio.play('menu_select');
                // Notify client of next round
                if (this.isOnline && this.isHost && this.roomManager) {
                    this.roomManager.broadcastGameEvent({ type: 'next_round' });
                }
                this.startNewRound();
            };
        }
    }

    // ============ GAME OVER ============
    setupGameOver() {
        // Broadcast game over to client
        if (this.isOnline && this.isHost && this.roomManager) {
            this.roomManager.broadcastGameEvent({
                type: 'round_over',
                winnerId: this._roundWinner || 0,
                scores: this.scores,
            });
        }

        const maxScore = Math.max(...this.scores);
        const winnerId = this.scores.indexOf(maxScore) + 1;
        this.audio.play('win');
        this.roundOverUI.showGameOver(winnerId, this.scores);

        if (this.isOnline && this.isClient) {
            // Client: hide buttons, show waiting for host
            this.roundOverUI.showWaitingOverlay();
        } else {
            this.roundOverUI.onRematch = () => {
                this.audio.play('menu_select');
                this.scores = [0, 0, 0, 0];
                this.currentRound = 0;
                this.players = [];
                if (this.isOnline && this.isHost && this.roomManager) {
                    // Tell client to show waiting screen, then go to map select
                    this.roomManager.broadcastGameEvent({ type: 'rematch' });
                    this.roundOverUI.hide();
                    this.cleanupState();
                    this.setState(STATES.MAP_SELECT);
                } else {
                    this.startNewRound();
                }
            };
            this.roundOverUI.onMenu = () => {
                this.audio.play('menu_select');
                this._cleanupOnline();
                this.setState(STATES.MENU);
            };
        }
    }

    _getLocalPlayerIndex() {
        if (this.isOnline && this.roomManager?.playerId) {
            return this.roomManager.playerId - 1;
        }
        return 0;
    }

    // ============ MOBILE CAMERA FOLLOW ============
    _updateMobileCamera() {
        const FOLLOW_HEIGHT = 7;   // units above ground
        const FOLLOW_Z_BACK = 5;   // units behind player
        const LERP = 0.1;          // per-frame lerp factor

        const localIdx = this._getLocalPlayerIndex();
        const p1 = this.players[localIdx]?.player;
        if (!p1 || !p1.alive) return;

        const px = p1.model.position.x;
        const pz = p1.model.position.z;
        const camera = this.sceneManager.camera;

        // Lerp camera toward follow target
        camera.position.x += (px - camera.position.x) * LERP;
        camera.position.y += (FOLLOW_HEIGHT - camera.position.y) * LERP;
        camera.position.z += (pz + FOLLOW_Z_BACK - camera.position.z) * LERP;

        // Always look at player
        camera.lookAt(px, 0, pz);

        // Keep ShakeEffect's basePosition in sync so shake applies on top
        // of the current follow position, not a stale snapshot
        if (this.shakeEffect.basePosition) {
            this.shakeEffect.basePosition.copy(camera.position);
        }
    }

    // ============ UPDATE & RENDER ============
    update(delta) {
        this.input.update();
        if (this.touchControls) this.touchControls.update();
        if (this.isOnline && this.isHost) {
            for (const ni of this.networkInputs.values()) ni.update();
        }

        // Update AI inputs
        for (const entry of this.players) {
            if (entry.isNPC && entry.aiInput) {
                entry.aiInput.update();
            }
        }

        // Client: send local input to host
        if (this.isOnline && this.isClient && this.roomManager &&
            (this.state === STATES.PLAYING || this.state === STATES.COUNTDOWN)) {
            this._sendClientInput();
        }

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

    // ============ ONLINE MULTIPLAYER ============

    setupOnlineLobby() {
        this.onlineLobbyUI.showLobbyChoice();

        this.onlineLobbyUI.onCreateRoom = async () => {
            this.roomManager = new RoomManager();
            const code = await this.roomManager.createRoom();
            this.isOnline = true;
            this.isHost = true;
            this.isClient = false;

            this.onlineLobbyUI.showWaiting(code, true);
            this._setupRoomCallbacks();

            // Host: START button triggers map select
            this.onlineLobbyUI.onStart = () => {
                this.audio.play('menu_select');
                this.onlineHumanCount = this.roomManager.getHumanCount();
                this.onlineLobbyUI.hide();
                this.setState(STATES.MAP_SELECT);
            };
        };

        this.onlineLobbyUI.onJoinRoom = async (code) => {
            this.roomManager = new RoomManager();
            await this.roomManager.joinRoom(code);
            this.isOnline = true;
            this.isHost = false;
            this.isClient = true;

            this.onlineLobbyUI.showWaiting(code, false);
            this._setupRoomCallbacks();
        };

        this.onlineLobbyUI.onBack = () => {
            this._cleanupOnline();
            this.setState(STATES.MODE_SELECT);
        };

        this.onlineLobbyUI.onCancel = () => {
            this._cleanupOnline();
            this.onlineLobbyUI.showLobbyChoice();
        };
    }

    _setupRoomCallbacks() {
        this.roomManager.onPeerJoin = () => {
            this.audio.play('menu_select');
            if (this.isHost) {
                // Host: update lobby with player count, stay in lobby
                this.onlineLobbyUI.updatePlayerCount(this.roomManager.playerCount);
            } else {
                // Client: show connected briefly, then wait for host
                this.onlineLobbyUI.showConnected(this.roomManager.roomCode);
                setTimeout(() => {
                    this.onlineLobbyUI.showWaitingForHost('Waiting for host to start...');
                    if (this.roomManager) {
                        this.onlineLobbyUI.updatePlayerCount(this.roomManager.playerCount);
                    }
                }, 1000);
            }
        };

        this.roomManager.onPlayerCountChange = (count) => {
            this.onlineLobbyUI.updatePlayerCount(count);
        };

        // DataChannel is open — P2P connection is truly ready
        this.roomManager.onPeerReady = (playerId) => {
            if (this.isHost) {
                // Only enable START when DataChannel is actually open
                this.onlineLobbyUI.setStartEnabled(
                    this.roomManager.peerManager.readyPeers.size >= 1
                );

                // If game already started, resend map info to late-connecting peer
                if (this.state !== STATES.ONLINE_LOBBY && this.state !== STATES.MAP_SELECT
                    && this.selectedMapIndex !== undefined) {
                    this.roomManager.peerManager.send(playerId, {
                        event: 'map_selected',
                        payload: { mapIndex: this.selectedMapIndex, humanCount: this.onlineHumanCount },
                    });
                }
            }
        };

        this.roomManager.onPeerLeave = () => {
            if (this.state === STATES.PLAYING || this.state === STATES.COUNTDOWN ||
                this.state === STATES.ROUND_OVER || this.state === STATES.GAME_OVER) {
                // Show disconnect during active game
                this.cleanupState();
                this.onlineLobbyUI.showDisconnected('A player left the game.');
                this.onlineLobbyUI.onBack = () => {
                    this._cleanupOnline();
                    this.setState(STATES.MENU);
                };
            } else if (this.isHost) {
                // Host in lobby: just update count
                this.onlineLobbyUI.updatePlayerCount(this.roomManager.playerCount);
            } else {
                this._cleanupOnline();
                this.setState(STATES.MENU);
            }
        };

        // Client receives game state from host
        this.roomManager.onGameState = (snapshot) => {
            if (this.isClient && this.gameSync) {
                // Handle state transitions from host
                if (snapshot.state === STATES.PLAYING && this.state === STATES.COUNTDOWN) {
                    this.setState(STATES.PLAYING);
                    this.hud.show(this.currentRound, MAX_ROUNDS, this.scores, this.players);
                }
                this.gameSync.applyState(this, snapshot);
            }
        };

        // Host receives remote player input (routed by playerId)
        this.roomManager.onRemoteInput = (inputState) => {
            if (this.isHost) {
                const id = inputState.playerId;
                const ni = this.networkInputs.get(id);
                if (ni) ni.applyRemoteInput(inputState);
            }
        };

        // Client receives map selection + humanCount from host
        this.roomManager.onMapSelected = (mapIndex, humanCount) => {
            if (this.isClient) {
                this.selectedMapIndex = mapIndex;
                this.onlineHumanCount = humanCount || 2;
                this.currentRound = 0;
                this.scores = [0, 0, 0, 0];
                this.onlineLobbyUI.hide();
                this.startNewRound();
            }
        };

        // Client receives game events (round over, game over)
        this.roomManager.onGameEvent = (event) => {
            if (!this.isClient) return;
            if (event.type === 'round_over') {
                this._roundWinner = event.winnerId;
                this.scores = event.scores;
                this.checkGameOver();
            } else if (event.type === 'next_round') {
                this.roundOverUI.hide();
                this.startNewRound();
            } else if (event.type === 'rematch') {
                // Host chose rematch — show waiting while host picks map
                this.roundOverUI.hide();
                this.cleanupState();
                this.scores = [0, 0, 0, 0];
                this.currentRound = 0;
                this.players = [];
                this.onlineLobbyUI.showWaitingForHost('Host is selecting a map...');
            }
        };

        this.roomManager.onError = (msg) => {
            this.onlineLobbyUI.showDisconnected(msg);
            this.onlineLobbyUI.onBack = () => {
                this._cleanupOnline();
                this.setState(STATES.MENU);
            };
        };
    }

    _sendClientInput() {
        const input = this._isMobile ? this.touchControls : this.input;
        // Client always uses P1 controls locally
        const keys = this._isMobile
            ? { UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT', BOMB: 'BOMB' }
            : P1_KEYS;

        const state = {
            keys: {
                UP: input.isKeyDown(keys.UP),
                DOWN: input.isKeyDown(keys.DOWN),
                LEFT: input.isKeyDown(keys.LEFT),
                RIGHT: input.isKeyDown(keys.RIGHT),
                BOMB: input.isKeyDown(keys.BOMB),
            },
            pressed: [],
        };

        if (input.wasKeyPressed(keys.BOMB)) {
            state.pressed.push('BOMB');
        }

        // Only send if changed (reduce bandwidth)
        const stateStr = JSON.stringify(state);
        if (stateStr !== this._lastSentInput) {
            this._lastSentInput = stateStr;
            this.roomManager.broadcastInput(state);
        }
    }

    _updateClientVisuals(delta) {
        // Client-only: run animations without game logic

        // Smooth player position interpolation (framerate-independent exponential lerp)
        const t = 1 - Math.exp(-12 * delta);
        for (const entry of this.players) {
            const p = entry.player;
            if (p._netTargetX !== undefined && p.alive) {
                p.model.position.x += (p._netTargetX - p.model.position.x) * t;
                p.model.position.y += (p._netTargetY - p.model.position.y) * t;
                p.model.position.z += (p._netTargetZ - p.model.position.z) * t;
                p.model.rotation.y = p._netTargetRY;
            }
        }

        // Death animations
        for (const entry of this.players) {
            const p = entry.player;
            if (!p.alive && p.deathTimer > 0) {
                p.deathTimer -= delta;
                const s = Math.max(0, p.deathTimer / 0.5);
                p.model.scale.set(s, s, s);
                p.model.rotation.y += delta * 15;
                if (p.deathTimer <= 0) p.model.visible = false;
            }
        }

        // Bomb animations
        for (const bomb of this.bombs) {
            bomb.update(delta);
        }

        // Explosion animations — visual interpolation only
        // Host controls lifecycle via _syncExplosions; client NEVER disposes here
        for (const exp of this.explosions) {
            if (exp.timer > 0) {
                exp.timer -= delta;
                if (exp.timer < 0) exp.timer = 0;
                const progress = 1 - (exp.timer / 0.5);
                for (const { mesh, mat } of exp.meshes) {
                    if (progress < 0.3) {
                        mat.color.setHex(0xff4500);
                        const s = 0.7 + progress * 1.0;
                        mesh.scale.set(s, 1 + progress * 2, s);
                    } else if (progress < 0.6) {
                        mat.color.setHex(0xffaa00);
                    } else {
                        mat.color.setHex(0xffdd44);
                    }
                    mat.opacity = Math.max(0, 1 - progress * 1.2);
                }
            }
        }

        // Block destruction animations
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            if (this.blocks[i].update(delta)) {
                this.blocks[i].dispose();
                this.blocks.splice(i, 1);
            }
        }

        // Power-up animations
        for (const pu of this.powerUps) pu.update(delta);

        // Particles and shake
        this.particles.update(delta);
        if (this._isMobile) this._updateMobileCamera();
        this.shakeEffect.update(delta);

        // HUD (throttled — stats only change on powerup pickup)
        this._hudUpdateTimer += delta;
        if (this._hudUpdateTimer >= this._hudUpdateInterval) {
            this._hudUpdateTimer = 0;
            this.hud.updateStats(this.players);
        }
    }

    _cleanupOnline() {
        if (this.roomManager) {
            this.roomManager.destroy();
            this.roomManager = null;
        }
        this.isOnline = false;
        this.isHost = false;
        this.isClient = false;
        for (const ni of this.networkInputs.values()) ni.reset();
        this.networkInputs.clear();
        this.onlineHumanCount = 2;
        this._lastSentInput = null;
        this.onlineLobbyUI.hide();
    }
}
