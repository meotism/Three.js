import { CELL } from '../map/MapData.js';

// BFS-based pathfinding for grid-based Bomberman.
// Supports danger-aware navigation and safe bomb placement checks.

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Pathfinder {

    // Generic BFS with flexible goal function.
    // goalFn(x, z) -> bool. Returns { path: [{x,z}...], distance } or null.
    static bfs(startX, startZ, goalFn, gridSystem, dangerMap = null, avoidDanger = true) {
        const key = (x, z) => `${x},${z}`;
        const visited = new Set();
        const queue = [{ x: startX, z: startZ, path: [] }];
        visited.add(key(startX, startZ));

        while (queue.length > 0) {
            const { x, z, path } = queue.shift();

            if (goalFn(x, z) && path.length > 0) {
                return { path, distance: path.length };
            }

            for (const [dx, dz] of DIRS) {
                const nx = x + dx;
                const nz = z + dz;
                const k = key(nx, nz);

                if (visited.has(k)) continue;
                if (!gridSystem.isWalkable(nx, nz)) continue;

                // Optionally avoid dangerous cells
                if (avoidDanger && dangerMap) {
                    const timeToReach = path.length + 1;
                    const timeToDanger = dangerMap.getTimeUntilDanger(nx, nz);
                    // Only walk through cell if we arrive before it becomes dangerous
                    // Use a safety margin of 0.5s (approx 2 steps at normal speed)
                    if (timeToDanger < timeToReach * 0.25 + 0.3) continue;
                }

                visited.add(k);
                queue.push({ x: nx, z: nz, path: [...path, { x: nx, z: nz }] });
            }
        }

        return null;
    }

    // Find nearest safe cell from start position
    static findNearestSafe(startX, startZ, gridSystem, dangerMap) {
        // If already safe, no need to move
        if (dangerMap.isSafe(startX, startZ)) return null;

        const key = (x, z) => `${x},${z}`;
        const visited = new Set();
        const queue = [{ x: startX, z: startZ, path: [] }];
        visited.add(key(startX, startZ));

        while (queue.length > 0) {
            const { x, z, path } = queue.shift();

            for (const [dx, dz] of DIRS) {
                const nx = x + dx;
                const nz = z + dz;
                const k = key(nx, nz);

                if (visited.has(k)) continue;
                if (!gridSystem.isWalkable(nx, nz)) continue;
                visited.add(k);

                const newPath = [...path, { x: nx, z: nz }];

                // Check if this cell is safe
                if (dangerMap.isSafe(nx, nz)) {
                    return { path: newPath, distance: newPath.length };
                }

                // Check if we can pass through before danger arrives
                const timeToReach = newPath.length;
                const timeToDanger = dangerMap.getTimeUntilDanger(nx, nz);
                if (timeToDanger > timeToReach * 0.25 + 0.2) {
                    queue.push({ x: nx, z: nz, path: newPath });
                }
            }
        }

        return null; // Trapped!
    }

    // Find path to a specific cell
    static findPathTo(startX, startZ, targetX, targetZ, gridSystem, dangerMap = null) {
        return Pathfinder.bfs(
            startX, startZ,
            (x, z) => x === targetX && z === targetZ,
            gridSystem, dangerMap, !!dangerMap
        );
    }

    // Check if placing a bomb at (bombX, bombZ) with given range has a safe escape from (playerX, playerZ)
    static canEscapeBomb(bombX, bombZ, bombRange, playerX, playerZ, gridSystem, dangerMap) {
        // Get cells that would be affected by this bomb
        const blastCells = dangerMap.simulateBomb(bombX, bombZ, bombRange, gridSystem);
        const blastSet = new Set(blastCells.map(c => `${c.x},${c.z}`));

        // BFS from player position, find a cell not in blast zone
        const key = (x, z) => `${x},${z}`;
        const visited = new Set();
        const queue = [{ x: playerX, z: playerZ, dist: 0 }];
        visited.add(key(playerX, playerZ));

        while (queue.length > 0) {
            const { x, z, dist } = queue.shift();

            // If this cell is not in any blast zone AND is safe from current dangers
            if (!blastSet.has(key(x, z)) && dangerMap.isSafe(x, z)) {
                // Can we reach it in time? Bomb fuse = 3s, movement ~ 0.25s per cell
                // Use conservative margin (2.2s) to account for decision delay and other bombs
                if (dist * 0.25 < 2.2) return true;
            }

            for (const [dx, dz] of DIRS) {
                const nx = x + dx;
                const nz = z + dz;
                const k = key(nx, nz);

                if (visited.has(k)) continue;
                // Can walk through if walkable (bomb cell itself is walkable for the placer initially)
                if (!gridSystem.isWalkable(nx, nz) && !(nx === bombX && nz === bombZ)) continue;
                visited.add(k);
                queue.push({ x: nx, z: nz, dist: dist + 1 });
            }
        }

        return false;
    }

    // Find nearest target matching goalFn, avoiding danger
    static findNearest(startX, startZ, goalFn, gridSystem, dangerMap = null) {
        return Pathfinder.bfs(startX, startZ, goalFn, gridSystem, dangerMap, !!dangerMap);
    }
}
