import { CELL } from '../map/MapData.js';

// Computes which grid cells are dangerous and when.
// Accounts for bomb blast zones, chain reactions, and active explosions.

export class DangerMap {
    constructor() {
        this.cols = 0;
        this.rows = 0;
        this.danger = null; // 2D array: danger[z][x] = timeUntilDanger (Infinity = safe)
    }

    compute(gridSystem, bombs, explosions) {
        this.cols = gridSystem.cols;
        this.rows = gridSystem.rows;

        // Initialize danger grid - all safe
        this.danger = [];
        for (let z = 0; z < this.rows; z++) {
            this.danger[z] = new Float32Array(this.cols).fill(Infinity);
        }

        // Mark cells with active explosions as immediately dangerous
        for (const exp of explosions) {
            for (const cell of exp.cells) {
                if (this._inBounds(cell.x, cell.z)) {
                    this.danger[cell.z][cell.x] = 0;
                }
            }
        }

        // Compute effective timers accounting for chain reactions
        const bombList = bombs.filter(b => !b.detonated);
        const effectiveTimers = new Map();
        for (const bomb of bombList) {
            effectiveTimers.set(bomb, bomb.timer);
        }

        // Chain reaction: iterate until stable
        for (let pass = 0; pass < 10; pass++) {
            let changed = false;
            for (const bombA of bombList) {
                const timerA = effectiveTimers.get(bombA);
                // Check if bombA's blast reaches other bombs
                const reachable = this._getBlastCells(bombA.gridX, bombA.gridZ, bombA.range, gridSystem);
                for (const bombB of bombList) {
                    if (bombA === bombB) continue;
                    for (const cell of reachable) {
                        if (cell.x === bombB.gridX && cell.z === bombB.gridZ) {
                            const newTimer = Math.min(effectiveTimers.get(bombB), timerA);
                            if (newTimer < effectiveTimers.get(bombB)) {
                                effectiveTimers.set(bombB, newTimer);
                                changed = true;
                            }
                        }
                    }
                }
            }
            if (!changed) break;
        }

        // Mark danger zones for each bomb using effective timers
        for (const bomb of bombList) {
            const timer = effectiveTimers.get(bomb);
            const blastCells = this._getBlastCells(bomb.gridX, bomb.gridZ, bomb.range, gridSystem);
            for (const cell of blastCells) {
                if (this._inBounds(cell.x, cell.z)) {
                    this.danger[cell.z][cell.x] = Math.min(this.danger[cell.z][cell.x], timer);
                }
            }
            // The bomb cell itself is dangerous
            if (this._inBounds(bomb.gridX, bomb.gridZ)) {
                this.danger[bomb.gridZ][bomb.gridX] = Math.min(
                    this.danger[bomb.gridZ][bomb.gridX], timer
                );
            }
        }
    }

    _getBlastCells(bx, bz, range, gridSystem) {
        const cells = [];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dz] of dirs) {
            for (let i = 1; i <= range; i++) {
                const nx = bx + dx * i;
                const nz = bz + dz * i;
                if (!gridSystem.isInBounds(nx, nz)) break;
                const cell = gridSystem.getCell(nx, nz);
                if (cell === CELL.WALL) break;
                cells.push({ x: nx, z: nz });
                if (cell === CELL.BLOCK) break; // Block stops blast but gets destroyed
            }
        }
        return cells;
    }

    _inBounds(x, z) {
        return x >= 0 && x < this.cols && z >= 0 && z < this.rows;
    }

    isDangerous(x, z) {
        if (!this._inBounds(x, z)) return true;
        return this.danger[z][x] < Infinity;
    }

    isSafe(x, z) {
        if (!this._inBounds(x, z)) return false;
        return this.danger[z][x] === Infinity;
    }

    getTimeUntilDanger(x, z) {
        if (!this._inBounds(x, z)) return 0;
        return this.danger[z][x];
    }

    // Simulate placing a bomb at (bx, bz) and return updated danger info
    simulateBomb(bx, bz, range, gridSystem) {
        const blastCells = this._getBlastCells(bx, bz, range, gridSystem);
        blastCells.push({ x: bx, z: bz }); // Include bomb cell itself
        return blastCells;
    }
}
