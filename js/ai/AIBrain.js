import { AIInput } from './AIInput.js';
import { DangerMap } from './DangerMap.js';
import { Pathfinder } from './Pathfinder.js';
import { CELL } from '../map/MapData.js';

// Expert-level NPC decision engine.
// Priority hierarchy: ESCAPE > ATTACK > COLLECT > DESTROY > EXPLORE

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class AIBrain {
    constructor(playerId) {
        this.playerId = playerId;
        this.aiInput = new AIInput();
        this.dangerMap = new DangerMap();

        // Current plan
        this.currentPath = null;
        this.pathIndex = 0;
        this.wantBomb = false;

        // Think timing - add variance to prevent lockstep
        this.thinkCooldown = 0;
        this.thinkInterval = 0.08 + Math.random() * 0.06; // 80-140ms between decisions

        // State tracking
        this.lastState = 'IDLE';
        this.stuckTimer = 0;
        this.lastGridX = -1;
        this.lastGridZ = -1;
    }

    update(delta, player, allPlayers, gridSystem, bombs, explosions, powerUps, blocks, sharedDangerMap) {
        if (!player.alive) {
            this.aiInput.reset();
            return;
        }

        // Only make decisions when at grid position (not mid-movement)
        if (player.moving) return;

        // Think cooldown
        this.thinkCooldown -= delta;
        if (this.thinkCooldown > 0) return;
        this.thinkCooldown = this.thinkInterval;

        // Reset input for this decision
        this.aiInput.clearMovement();
        this.wantBomb = false;

        // Use shared danger map if provided, otherwise compute own
        if (sharedDangerMap && sharedDangerMap !== this.dangerMap) {
            this.dangerMap = sharedDangerMap;
        } else {
            this.dangerMap.compute(gridSystem, bombs, explosions);
        }

        const myX = player.gridX;
        const myZ = player.gridZ;

        // Track stuck detection
        if (myX === this.lastGridX && myZ === this.lastGridZ) {
            this.stuckTimer += this.thinkInterval;
        } else {
            this.stuckTimer = 0;
        }
        this.lastGridX = myX;
        this.lastGridZ = myZ;

        // Count remaining blocks to gauge game phase
        let blockCount = 0;
        for (let z = 0; z < gridSystem.rows; z++) {
            for (let x = 0; x < gridSystem.cols; x++) {
                if (gridSystem.getCell(x, z) === CELL.BLOCK) blockCount++;
            }
        }
        const lateGame = blockCount < 15;

        // Decision priority
        let decided = false;

        // Priority 1: ESCAPE - am I in danger?
        if (!decided && this.dangerMap.isDangerous(myX, myZ)) {
            decided = this._doEscape(myX, myZ, gridSystem);
            this.lastState = 'ESCAPE';
        }

        // Priority 2: ATTACK - can I bomb an opponent?
        if (!decided) {
            decided = this._doAttack(myX, myZ, player, allPlayers, gridSystem, lateGame);
            if (decided) this.lastState = 'ATTACK';
        }

        // Priority 3: COLLECT - any nearby power-ups? (only nearby so we don't wander)
        if (!decided) {
            decided = this._doCollect(myX, myZ, powerUps, gridSystem, lateGame);
            if (decided) this.lastState = 'COLLECT';
        }

        // Priority 4: DESTROY - bomb blocks for power-ups
        if (!decided) {
            decided = this._doDestroy(myX, myZ, player, gridSystem);
            if (decided) this.lastState = 'DESTROY';
        }

        // Priority 5: EXPLORE - move toward opponents or center
        if (!decided) {
            this._doExplore(myX, myZ, allPlayers, gridSystem);
            this.lastState = 'EXPLORE';
        }

        // Execute planned bomb
        if (this.wantBomb) {
            this.aiInput.setBomb(true);
        } else {
            this.aiInput.setBomb(false);
        }
    }

    // Priority 1: Escape danger zone
    _doEscape(myX, myZ, gridSystem) {
        const escape = Pathfinder.findNearestSafe(myX, myZ, gridSystem, this.dangerMap);
        if (escape && escape.path.length > 0) {
            this._moveToward(escape.path[0]);
            return true;
        }
        // No safe cell found - try any walkable neighbor that's less dangerous
        let bestDir = null;
        let bestTime = this.dangerMap.getTimeUntilDanger(myX, myZ);
        for (const [dx, dz] of DIRS) {
            const nx = myX + dx;
            const nz = myZ + dz;
            if (!gridSystem.isWalkable(nx, nz)) continue;
            const t = this.dangerMap.getTimeUntilDanger(nx, nz);
            if (t > bestTime) {
                bestTime = t;
                bestDir = { dx, dz };
            }
        }
        if (bestDir) {
            this.aiInput.setDirection(bestDir.dx, bestDir.dz);
            return true;
        }
        return false;
    }

    // Priority 2: Attack opponents
    _doAttack(myX, myZ, player, allPlayers, gridSystem, lateGame) {
        if (player.activeBombs >= player.maxBombs) return false;

        const opponents = allPlayers.filter(p =>
            p.alive && p.id !== this.playerId
        );
        if (opponents.length === 0) return false;

        // Check if any opponent is in current bomb range (direct hit)
        const blastCells = this.dangerMap.simulateBomb(myX, myZ, player.bombRange, gridSystem);
        const blastSet = new Set(blastCells.map(c => `${c.x},${c.z}`));

        for (const opp of opponents) {
            if (blastSet.has(`${opp.gridX},${opp.gridZ}`)) {
                if (Pathfinder.canEscapeBomb(myX, myZ, player.bombRange, myX, myZ, gridSystem, this.dangerMap)) {
                    this.wantBomb = true;
                    return true;
                }
            }
        }

        // Find nearest opponent
        let nearestOpp = null;
        let nearestDist = Infinity;
        for (const opp of opponents) {
            const dist = Math.abs(opp.gridX - myX) + Math.abs(opp.gridZ - myZ);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestOpp = opp;
            }
        }

        if (!nearestOpp) return false;

        // Aggressive bombing: if close to opponent, bomb to pressure/trap
        // But only if we have multiple escape routes (safety check)
        if (nearestDist <= 4) {
            // Count safe walkable neighbors (escape directions)
            let safeExits = 0;
            const blastCells = this.dangerMap.simulateBomb(myX, myZ, player.bombRange, gridSystem);
            const blastCheck = new Set(blastCells.map(c => `${c.x},${c.z}`));
            for (const [dx, dz] of DIRS) {
                const nx = myX + dx;
                const nz = myZ + dz;
                if (gridSystem.isWalkable(nx, nz) && !blastCheck.has(`${nx},${nz}`) && this.dangerMap.isSafe(nx, nz)) {
                    safeExits++;
                }
            }

            // Only bomb aggressively if at least 2 escape directions exist
            if (safeExits >= 2) {
                if (myX === nearestOpp.gridX || myZ === nearestOpp.gridZ || nearestDist <= 2) {
                    if (Pathfinder.canEscapeBomb(myX, myZ, player.bombRange, myX, myZ, gridSystem, this.dangerMap)) {
                        this.wantBomb = true;
                        return true;
                    }
                }
            }
        }

        // Pursue opponent across the map
        const path = Pathfinder.findPathTo(myX, myZ, nearestOpp.gridX, nearestOpp.gridZ, gridSystem, this.dangerMap);
        if (path && path.path.length > 0) {
            this._moveToward(path.path[0]);
            return true;
        }

        // Path blocked — bomb blocks in the direction of the opponent to open a route
        if (player.activeBombs < player.maxBombs) {
            const dx = Math.sign(nearestOpp.gridX - myX);
            const dz = Math.sign(nearestOpp.gridZ - myZ);
            // Check if there's a block in the opponent's direction we can bomb
            const dirs = [];
            if (dx !== 0) dirs.push([dx, 0]);
            if (dz !== 0) dirs.push([0, dz]);
            for (const [ddx, ddz] of dirs) {
                for (let i = 1; i <= player.bombRange; i++) {
                    const bx = myX + ddx * i;
                    const bz = myZ + ddz * i;
                    if (!gridSystem.isInBounds(bx, bz)) break;
                    const cell = gridSystem.getCell(bx, bz);
                    if (cell === CELL.WALL) break;
                    if (cell === CELL.BLOCK) {
                        if (Pathfinder.canEscapeBomb(myX, myZ, player.bombRange, myX, myZ, gridSystem, this.dangerMap)) {
                            this.wantBomb = true;
                            return true;
                        }
                        break;
                    }
                }
            }
        }

        return false;
    }

    // Priority 3: Collect power-ups (only nearby to avoid wandering)
    _doCollect(myX, myZ, powerUps, gridSystem, lateGame) {
        if (powerUps.length === 0) return false;

        // Only collect very close power-ups — prioritize DESTROY/ATTACK
        const maxDist = lateGame ? 2 : 3;

        const result = Pathfinder.findNearest(
            myX, myZ,
            (x, z) => powerUps.some(pu => !pu.collected && pu.gridX === x && pu.gridZ === z),
            gridSystem, this.dangerMap
        );

        if (result && result.path.length > 0 && result.distance <= maxDist) {
            this._moveToward(result.path[0]);
            return true;
        }
        return false;
    }

    // Priority 4: Destroy blocks
    _doDestroy(myX, myZ, player, gridSystem) {
        if (player.activeBombs >= player.maxBombs) return false;

        // Check if any cell in bomb range has a block
        let hasAdjacentBlock = false;
        for (const [dx, dz] of DIRS) {
            for (let i = 1; i <= player.bombRange; i++) {
                const nx = myX + dx * i;
                const nz = myZ + dz * i;
                if (!gridSystem.isInBounds(nx, nz)) break;
                const cell = gridSystem.getCell(nx, nz);
                if (cell === CELL.WALL) break;
                if (cell === CELL.BLOCK) {
                    hasAdjacentBlock = true;
                    break;
                }
            }
            if (hasAdjacentBlock) break;
        }

        if (hasAdjacentBlock) {
            if (Pathfinder.canEscapeBomb(myX, myZ, player.bombRange, myX, myZ, gridSystem, this.dangerMap)) {
                this.wantBomb = true;
                return true;
            }
        }

        // Move toward nearest block to destroy
        const result = Pathfinder.bfs(
            myX, myZ,
            (x, z) => {
                // Check if this position is adjacent to a block
                for (const [dx, dz] of DIRS) {
                    const bx = x + dx;
                    const bz = z + dz;
                    if (gridSystem.isInBounds(bx, bz) && gridSystem.getCell(bx, bz) === CELL.BLOCK) {
                        return true;
                    }
                }
                return false;
            },
            gridSystem, this.dangerMap, true
        );

        if (result && result.path.length > 0) {
            this._moveToward(result.path[0]);
            return true;
        }
        return false;
    }

    // Priority 5: Explore / move toward opponents
    _doExplore(myX, myZ, allPlayers, gridSystem) {
        const opponents = allPlayers.filter(p => p.alive && p.id !== this.playerId);

        // Move toward nearest opponent
        if (opponents.length > 0) {
            let nearest = null;
            let nearestDist = Infinity;
            for (const opp of opponents) {
                const dist = Math.abs(opp.gridX - myX) + Math.abs(opp.gridZ - myZ);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = opp;
                }
            }

            if (nearest) {
                const path = Pathfinder.findPathTo(myX, myZ, nearest.gridX, nearest.gridZ, gridSystem, this.dangerMap);
                if (path && path.path.length > 0) {
                    this._moveToward(path.path[0]);
                    return;
                }
            }
        }

        // Fallback: move toward center of map
        const centerX = Math.floor(this.dangerMap.cols / 2);
        const centerZ = Math.floor(this.dangerMap.rows / 2);
        const path = Pathfinder.findPathTo(myX, myZ, centerX, centerZ, gridSystem, this.dangerMap);
        if (path && path.path.length > 0) {
            this._moveToward(path.path[0]);
            return;
        }

        // Fallback: random safe direction
        if (this.stuckTimer > 0.5) {
            const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
            for (const [dx, dz] of shuffled) {
                const nx = myX + dx;
                const nz = myZ + dz;
                if (gridSystem.isWalkable(nx, nz) && this.dangerMap.isSafe(nx, nz)) {
                    this.aiInput.setDirection(dx, dz);
                    this.stuckTimer = 0;
                    return;
                }
            }
        }
    }

    _moveToward(target) {
        // target is {x, z} - the next cell to move to
        // We're currently at lastGridX, lastGridZ
        const dx = target.x - this.lastGridX;
        const dz = target.z - this.lastGridZ;
        this.aiInput.setDirection(dx, dz);
    }
}
