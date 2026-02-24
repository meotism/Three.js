import { CELL } from './MapData.js';
import { Wall } from '../entities/Wall.js';
import { Block } from '../entities/Block.js';

export class MapLoader {
    constructor(scene) {
        this.scene = scene;
    }

    load(mapDef) {
        const { cols, rows, grid, theme } = mapDef;
        const walls = [];
        const blocks = [];
        const floorGroup = new THREE.Group();

        // Create floor
        const floorGeo = new THREE.PlaneGeometry(cols, rows);
        const floorMat = new THREE.MeshStandardMaterial({
            color: theme.floorColor,
            roughness: 0.9,
            metalness: 0.0,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set((cols - 1) / 2, 0, (rows - 1) / 2);
        floor.receiveShadow = true;
        floorGroup.add(floor);

        // Checkerboard tiles on top
        const tileGeo = new THREE.PlaneGeometry(1, 1);
        for (let z = 0; z < rows; z++) {
            for (let x = 0; x < cols; x++) {
                const cellType = grid[z][x];
                if (cellType === CELL.WALL) continue;
                const isAlt = (x + z) % 2 === 0;
                const tileMat = new THREE.MeshStandardMaterial({
                    color: isAlt ? theme.floorColor : theme.floorColor2,
                    roughness: 0.95,
                });
                const tile = new THREE.Mesh(tileGeo, tileMat);
                tile.rotation.x = -Math.PI / 2;
                tile.position.set(x, 0.001, z);
                tile.receiveShadow = true;
                floorGroup.add(tile);
            }
        }
        this.scene.add(floorGroup);

        // Create walls and blocks
        for (let z = 0; z < rows; z++) {
            for (let x = 0; x < cols; x++) {
                const cellType = grid[z][x];
                if (cellType === CELL.WALL) {
                    const wall = new Wall(x, z, theme.wallColor);
                    this.scene.add(wall.mesh);
                    walls.push(wall);
                } else if (cellType === CELL.BLOCK) {
                    const block = new Block(x, z, theme.blockColor);
                    this.scene.add(block.mesh);
                    blocks.push(block);
                }
            }
        }

        // Update scene background
        this.scene.background = new THREE.Color(theme.skyColor);

        return { walls, blocks, floorGroup };
    }
}
