import { Bomb } from '../entities/Bomb.js';
import { Explosion } from '../entities/Explosion.js';
import { PowerUp, POWERUP_TYPES } from '../entities/PowerUp.js';

// Shared explosion geometry — created once, reused by all client-side explosions
let _sharedExplosionGeo = null;
function getSharedExplosionGeo() {
    if (!_sharedExplosionGeo) {
        _sharedExplosionGeo = new THREE.BoxGeometry(0.7, 0.35, 0.7);
    }
    return _sharedExplosionGeo;
}

export class GameSync {
    constructor() {
        this._sendTimer = 0;
        this._sendInterval = 1 / 15; // 15 Hz
        this._lastStateTimestamp = 0;

        // Grid delta tracking
        this._prevGrid = null;

        // Reusable containers (avoid GC pressure from Set/Map recreation)
        this._tempSet = new Set();
        this._tempMap = new Map();

        // Effect throttling for chain explosions
        this._lastExplosionEffectTime = 0;
        this._explosionEffectCooldown = 0.15; // 150ms min between effects
    }

    // Called by host every frame. Throttles broadcast to 15Hz.
    tickHost(delta, game, roomManager) {
        this._sendTimer += delta;
        if (this._sendTimer >= this._sendInterval) {
            this._sendTimer = 0;
            const snapshot = this.serializeState(game);
            roomManager.broadcastGameState(snapshot);
        }
    }

    // -------- Serialization (host → client) --------

    serializeState(game) {
        return {
            t: Date.now(),
            state: game.state,
            round: game.currentRound,
            scores: game.scores,
            countdownTimer: game.countdownTimer,

            players: game.players.map(entry => {
                const p = entry.player;
                return {
                    id: p.id,
                    alive: p.alive,
                    gx: p.gridX,
                    gz: p.gridZ,
                    tx: p.targetGridX,
                    tz: p.targetGridZ,
                    px: Math.round(p.model.position.x * 100) / 100,
                    py: Math.round(p.model.position.y * 100) / 100,
                    pz: Math.round(p.model.position.z * 100) / 100,
                    ry: Math.round(p.model.rotation.y * 100) / 100,
                    moving: p.moving,
                    bombRange: p.bombRange,
                    maxBombs: p.maxBombs,
                    activeBombs: p.activeBombs,
                    speed: p.speed,
                    deathTimer: p.deathTimer,
                    visible: p.model.visible,
                };
            }),

            bombs: game.bombs.map(b => ({
                gx: b.gridX,
                gz: b.gridZ,
                range: b.range,
                ownerId: b.ownerId,
                timer: Math.round(b.timer * 100) / 100,
            })),

            explosions: game.explosions.map(e => ({
                cells: e.cells, // [{x,z}, ...]
                timer: Math.round(e.timer * 100) / 100,
            })),

            powerUps: game.powerUps.map(pu => ({
                gx: pu.gridX,
                gz: pu.gridZ,
                type: pu.type.id,
            })),

            // Grid delta sync — only send changes
            grid: this._serializeGridDelta(game.gridSystem),
        };
    }

    _serializeGridDelta(gridSystem) {
        if (!gridSystem) return null;
        const grid = gridSystem.grid;

        // First sync or round reset: send full grid
        if (!this._prevGrid || this._prevGrid.length !== grid.length) {
            this._prevGrid = grid.map(row => [...row]);
            return { full: grid.map(row => [...row]) };
        }

        // Subsequent: only send changed cells
        const changes = [];
        for (let z = 0; z < grid.length; z++) {
            for (let x = 0; x < grid[z].length; x++) {
                if (grid[z][x] !== this._prevGrid[z][x]) {
                    changes.push({ x, z, v: grid[z][x] });
                    this._prevGrid[z][x] = grid[z][x];
                }
            }
        }

        // Too many changes → send full (e.g., round reset)
        if (changes.length > 20) {
            this._prevGrid = grid.map(row => [...row]);
            return { full: grid.map(row => [...row]) };
        }

        return changes.length > 0 ? { delta: changes } : null;
    }

    // Reset grid tracking (call on new round)
    resetGridDelta() {
        this._prevGrid = null;
    }

    // -------- Deserialization (client applies host state) --------

    applyState(game, snapshot) {
        // Discard stale packets
        if (snapshot.t < this._lastStateTimestamp) return;
        this._lastStateTimestamp = snapshot.t;

        // Scores & round
        game.scores = snapshot.scores;
        game.currentRound = snapshot.round;
        game.countdownTimer = snapshot.countdownTimer;

        // Players — store targets for smooth interpolation
        this._syncPlayers(game, snapshot.players);

        // Bombs
        this._syncBombs(game, snapshot.bombs);

        // Explosions — host-authoritative lifecycle
        this._syncExplosions(game, snapshot.explosions);

        // Power-ups
        this._syncPowerUps(game, snapshot.powerUps);

        // Grid (delta) — also destroy block meshes when cells change to EMPTY
        if (snapshot.grid && game.gridSystem) {
            if (snapshot.grid.full) {
                // Full grid: destroy any block whose cell is now EMPTY
                const g = snapshot.grid.full;
                for (let i = game.blocks.length - 1; i >= 0; i--) {
                    const b = game.blocks[i];
                    if (b.alive && g[b.gridZ] && g[b.gridZ][b.gridX] === 0) {
                        b.destroy();
                    }
                }
                game.gridSystem.grid = g;
            } else if (snapshot.grid.delta) {
                for (const c of snapshot.grid.delta) {
                    // Cell changed to EMPTY — find and destroy the block mesh
                    if (c.v === 0) {
                        for (let i = game.blocks.length - 1; i >= 0; i--) {
                            const b = game.blocks[i];
                            if (b.alive && b.gridX === c.x && b.gridZ === c.z) {
                                b.destroy();
                                break;
                            }
                        }
                    }
                    game.gridSystem.grid[c.z][c.x] = c.v;
                }
            }
        }
    }

    _syncPlayers(game, playersData) {
        for (const pd of playersData) {
            const entry = game.players[pd.id - 1];
            if (!entry) continue;
            const p = entry.player;

            p.gridX = pd.gx;
            p.gridZ = pd.gz;
            p.targetGridX = pd.tx;
            p.targetGridZ = pd.tz;
            p.moving = pd.moving;
            p.bombRange = pd.bombRange;
            p.maxBombs = pd.maxBombs;
            p.activeBombs = pd.activeBombs;
            p.speed = pd.speed;

            // Store target positions for smooth interpolation in _updateClientVisuals
            p._netTargetX = pd.px;
            p._netTargetY = pd.py;
            p._netTargetZ = pd.pz;
            p._netTargetRY = pd.ry;

            // Death transition
            if (!pd.alive && p.alive) {
                p.die();
            }
            if (pd.alive && !p.alive) {
                // Respawn (new round)
                p.alive = true;
                p.model.visible = true;
                p.model.scale.set(1, 1, 1);
            }
            p.deathTimer = pd.deathTimer;
            p.model.visible = pd.visible;
        }
    }

    _syncBombs(game, bombsData) {
        // Reuse containers to avoid GC pressure
        const expected = this._tempSet;
        expected.clear();
        for (const b of bombsData) expected.add(`${b.gx},${b.gz}`);

        // Remove bombs that no longer exist on host
        for (let i = game.bombs.length - 1; i >= 0; i--) {
            const b = game.bombs[i];
            if (!expected.has(`${b.gridX},${b.gridZ}`)) {
                b.dispose();
                game.bombs.splice(i, 1);
            }
        }

        // Add missing bombs, update existing
        const existing = this._tempMap;
        existing.clear();
        for (const b of game.bombs) existing.set(`${b.gridX},${b.gridZ}`, b);

        for (const bd of bombsData) {
            const key = `${bd.gx},${bd.gz}`;
            const bomb = existing.get(key);
            if (bomb) {
                bomb.timer = bd.timer;
            } else {
                const newBomb = new Bomb(bd.gx, bd.gz, bd.range, bd.ownerId);
                newBomb.timer = bd.timer;
                game.bombs.push(newBomb);
                game.sceneManager.scene.add(newBomb.model);
            }
        }
    }

    _syncExplosions(game, explosionsData) {
        // Build Map of host explosions keyed by center cell
        const hostMap = this._tempMap;
        hostMap.clear();
        for (const ed of explosionsData) {
            if (ed.cells.length > 0) {
                hostMap.set(`${ed.cells[0].x},${ed.cells[0].z}`, ed);
            }
        }

        // Build Map of existing client explosions
        const clientMap = new Map();
        for (let i = 0; i < game.explosions.length; i++) {
            const e = game.explosions[i];
            if (e.cells && e.cells[0]) {
                clientMap.set(`${e.cells[0].x},${e.cells[0].z}`, e);
            }
        }

        // Remove client explosions no longer on host
        for (let i = game.explosions.length - 1; i >= 0; i--) {
            const e = game.explosions[i];
            const center = e.cells && e.cells[0];
            if (!center || !hostMap.has(`${center.x},${center.z}`)) {
                e.dispose();
                game.explosions.splice(i, 1);
            }
        }

        // Add new or update existing explosions
        for (const [key, ed] of hostMap) {
            if (ed.timer <= 0) continue;
            const existing = clientMap.get(key);
            if (existing && game.explosions.includes(existing)) {
                // Update timer from host (authoritative)
                existing.timer = ed.timer;
            } else {
                // New explosion — create visual
                const exp = this._createExplosionFromCells(ed.cells, ed.timer);
                game.explosions.push(exp);
                game.sceneManager.scene.add(exp.group);
                this._emitExplosionEffects(game, ed.cells[0]);
            }
        }
    }

    _emitExplosionEffects(game, center) {
        const now = performance.now() / 1000;
        if (now - this._lastExplosionEffectTime < this._explosionEffectCooldown) {
            return; // Throttle chain explosion effects
        }
        this._lastExplosionEffectTime = now;
        game.audio.play('explosion');
        game.shakeEffect.shake(0.12);
        game.particles.emit(center.x, 0.3, center.z, 15, 0xff4500);
    }

    _createExplosionFromCells(cells, timer) {
        const group = new THREE.Group();
        const meshes = [];
        const geo = getSharedExplosionGeo(); // Shared — never disposed per cell

        for (const cell of cells) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xff4500,
                transparent: true,
                opacity: 0.9,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(cell.x, 0.25, cell.z);
            group.add(mesh);
            meshes.push({ mesh, mat });
        }

        return {
            cells,
            timer,
            meshes,
            group,
            update(delta) {
                this.timer -= delta;
                const progress = 1 - (this.timer / 0.5);
                for (const { mesh, mat } of this.meshes) {
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
                return this.timer <= 0;
            },
            hitsCell(x, z) {
                return this.cells.some(c => c.x === x && c.z === z);
            },
            dispose() {
                if (this.group.parent) this.group.parent.remove(this.group);
                for (const { mesh, mat } of this.meshes) {
                    // Do NOT dispose geometry — it's shared
                    mat.dispose();
                }
            },
        };
    }

    _syncPowerUps(game, powerUpsData) {
        // Reuse Set to avoid GC pressure
        const expected = this._tempSet;
        expected.clear();
        for (const p of powerUpsData) expected.add(`${p.gx},${p.gz}`);

        // Remove collected / missing
        for (let i = game.powerUps.length - 1; i >= 0; i--) {
            const pu = game.powerUps[i];
            if (!expected.has(`${pu.gridX},${pu.gridZ}`)) {
                pu.dispose();
                game.powerUps.splice(i, 1);
            }
        }

        // Build existing set from current client powerups
        expected.clear();
        for (const p of game.powerUps) expected.add(`${p.gridX},${p.gridZ}`);

        // Add new
        for (const pd of powerUpsData) {
            if (!expected.has(`${pd.gx},${pd.gz}`)) {
                const type = POWERUP_TYPES.find(t => t.id === pd.type);
                if (!type) continue;
                const pu = new PowerUp(pd.gx, pd.gz, type);
                game.powerUps.push(pu);
                game.sceneManager.scene.add(pu.model);
            }
        }
    }
}
