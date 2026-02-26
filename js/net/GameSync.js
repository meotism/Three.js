import { Bomb } from '../entities/Bomb.js';
import { Explosion } from '../entities/Explosion.js';
import { PowerUp, POWERUP_TYPES } from '../entities/PowerUp.js';

export class GameSync {
    constructor() {
        this._sendTimer = 0;
        this._sendInterval = 1 / 15; // 15 Hz
        this._lastStateTimestamp = 0;
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

            // Send grid so client can reconstruct walkability
            grid: game.gridSystem ? game.gridSystem.grid.map(row => [...row]) : null,
        };
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

        // Players
        this._syncPlayers(game, snapshot.players);

        // Bombs
        this._syncBombs(game, snapshot.bombs);

        // Explosions
        this._syncExplosions(game, snapshot.explosions);

        // Power-ups
        this._syncPowerUps(game, snapshot.powerUps);

        // Grid
        if (snapshot.grid && game.gridSystem) {
            game.gridSystem.grid = snapshot.grid.map(row => [...row]);
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

            // Smooth interpolation toward authoritative position
            const lerp = 0.3;
            p.model.position.x += (pd.px - p.model.position.x) * lerp;
            p.model.position.y += (pd.py - p.model.position.y) * lerp;
            p.model.position.z += (pd.pz - p.model.position.z) * lerp;
            p.model.rotation.y = pd.ry;

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
        const expected = new Set(bombsData.map(b => `${b.gx},${b.gz}`));

        // Remove bombs that no longer exist on host
        for (let i = game.bombs.length - 1; i >= 0; i--) {
            const b = game.bombs[i];
            if (!expected.has(`${b.gridX},${b.gridZ}`)) {
                b.dispose();
                game.bombs.splice(i, 1);
            }
        }

        // Add missing bombs, update existing
        const existing = new Map(game.bombs.map(b => [`${b.gridX},${b.gridZ}`, b]));
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
        // Build set of active explosion centers from host
        const hostCenters = new Set();
        for (const ed of explosionsData) {
            if (ed.cells.length > 0) hostCenters.add(`${ed.cells[0].x},${ed.cells[0].z}`);
        }

        // Remove client explosions that host no longer has
        for (let i = game.explosions.length - 1; i >= 0; i--) {
            const e = game.explosions[i];
            const center = e.cells[0];
            if (!center || !hostCenters.has(`${center.x},${center.z}`)) {
                e.dispose();
                game.explosions.splice(i, 1);
            }
        }

        // Add new explosions from host
        const clientCenters = new Set();
        for (const e of game.explosions) {
            if (e.cells[0]) clientCenters.add(`${e.cells[0].x},${e.cells[0].z}`);
        }

        for (const ed of explosionsData) {
            if (ed.cells.length === 0 || ed.timer <= 0) continue;
            const center = ed.cells[0];
            if (clientCenters.has(`${center.x},${center.z}`)) {
                // Update timer on existing
                const existing = game.explosions.find(e =>
                    e.cells[0] && e.cells[0].x === center.x && e.cells[0].z === center.z
                );
                if (existing) existing.timer = ed.timer;
            } else {
                // Create visual-only explosion on client
                const exp = this._createExplosionFromCells(ed.cells, ed.timer);
                game.explosions.push(exp);
                game.sceneManager.scene.add(exp.group);
                game.audio.play('explosion');
                game.shakeEffect.shake(0.12);
                game.particles.emit(center.x, 0.3, center.z, 25, 0xff4500);
            }
        }
    }

    _createExplosionFromCells(cells, timer) {
        const group = new THREE.Group();
        const meshes = [];

        for (const cell of cells) {
            const geo = new THREE.BoxGeometry(0.7, 0.35, 0.7);
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
                    mesh.geometry.dispose();
                    mat.dispose();
                }
            },
        };
    }

    _syncPowerUps(game, powerUpsData) {
        const expected = new Set(powerUpsData.map(p => `${p.gx},${p.gz}`));

        // Remove collected / missing
        for (let i = game.powerUps.length - 1; i >= 0; i--) {
            const pu = game.powerUps[i];
            if (!expected.has(`${pu.gridX},${pu.gridZ}`)) {
                pu.dispose();
                game.powerUps.splice(i, 1);
            }
        }

        // Add new
        const existing = new Set(game.powerUps.map(p => `${p.gridX},${p.gridZ}`));
        for (const pd of powerUpsData) {
            if (!existing.has(`${pd.gx},${pd.gz}`)) {
                const type = POWERUP_TYPES.find(t => t.id === pd.type);
                if (!type) continue;
                const pu = new PowerUp(pd.gx, pd.gz, type);
                game.powerUps.push(pu);
                game.sceneManager.scene.add(pu.model);
            }
        }
    }
}
