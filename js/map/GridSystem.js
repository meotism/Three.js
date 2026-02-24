import { CELL } from './MapData.js';

export class GridSystem {
    constructor(mapGrid, cols, rows) {
        this.cols = cols;
        this.rows = rows;
        // Deep copy for runtime mutation
        this.grid = mapGrid.map(row => [...row]);
        // Normalize spawn cells to empty
        for (let z = 0; z < rows; z++) {
            for (let x = 0; x < cols; x++) {
                if (this.grid[z][x] === CELL.SPAWN_P1 || this.grid[z][x] === CELL.SPAWN_P2) {
                    this.grid[z][x] = CELL.EMPTY;
                }
            }
        }
        this.entities = new Map(); // "x,z" -> entity reference
    }

    isInBounds(x, z) {
        return x >= 0 && x < this.cols && z >= 0 && z < this.rows;
    }

    getCell(x, z) {
        if (!this.isInBounds(x, z)) return CELL.WALL;
        return this.grid[z][x];
    }

    setCell(x, z, value) {
        if (this.isInBounds(x, z)) {
            this.grid[z][x] = value;
        }
    }

    isWalkable(x, z) {
        if (!this.isInBounds(x, z)) return false;
        const cell = this.grid[z][x];
        return cell === CELL.EMPTY;
    }

    placeBomb(x, z, bombEntity) {
        this.grid[z][x] = CELL.BOMB;
        this.entities.set(`${x},${z}`, bombEntity);
    }

    removeBomb(x, z) {
        this.grid[z][x] = CELL.EMPTY;
        this.entities.delete(`${x},${z}`);
    }

    destroyBlock(x, z) {
        if (this.grid[z][x] === CELL.BLOCK) {
            this.grid[z][x] = CELL.EMPTY;
            return true;
        }
        return false;
    }

    getBombAt(x, z) {
        return this.entities.get(`${x},${z}`) || null;
    }

    static getSpawnPositions(mapDef) {
        const spawns = { p1: [], p2: [] };
        for (let z = 0; z < mapDef.rows; z++) {
            for (let x = 0; x < mapDef.cols; x++) {
                if (mapDef.grid[z][x] === CELL.SPAWN_P1) spawns.p1.push({ x, z });
                if (mapDef.grid[z][x] === CELL.SPAWN_P2) spawns.p2.push({ x, z });
            }
        }
        return {
            p1: spawns.p1[0] || { x: 1, z: 1 },
            p2: spawns.p2[0] || { x: mapDef.cols - 2, z: 1 },
        };
    }
}
