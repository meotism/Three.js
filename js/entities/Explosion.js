import { CELL } from '../map/MapData.js';

// Shared geometry — created once, reused by all explosions
let _sharedGeo = null;
function getSharedGeo() {
    if (!_sharedGeo) {
        _sharedGeo = new THREE.BoxGeometry(0.7, 0.35, 0.7);
    }
    return _sharedGeo;
}

export class Explosion {
    constructor(gridX, gridZ, range, gridSystem) {
        this.cells = [];
        this.timer = 0.5;
        this.meshes = [];
        this.group = new THREE.Group();

        // BFS spread in 4 directions
        this.cells.push({ x: gridX, z: gridZ });
        this.createSegment(gridX, gridZ);

        const directions = [
            { dx: 0, dz: -1 },
            { dx: 0, dz: 1 },
            { dx: -1, dz: 0 },
            { dx: 1, dz: 0 },
        ];

        this.destroyedBlocks = [];
        this.chainBombs = [];

        for (const dir of directions) {
            for (let i = 1; i <= range; i++) {
                const cx = gridX + dir.dx * i;
                const cz = gridZ + dir.dz * i;

                if (!gridSystem.isInBounds(cx, cz)) break;

                const cell = gridSystem.getCell(cx, cz);

                if (cell === CELL.WALL) break;

                this.cells.push({ x: cx, z: cz });
                this.createSegment(cx, cz);

                if (cell === CELL.BLOCK) {
                    this.destroyedBlocks.push({ x: cx, z: cz });
                    break; // block stops spread but gets destroyed
                }

                if (cell === CELL.BOMB) {
                    this.chainBombs.push({ x: cx, z: cz });
                    break;
                }
            }
        }
    }

    createSegment(x, z) {
        const geo = getSharedGeo(); // Shared geometry — never disposed per cell
        const mat = new THREE.MeshBasicMaterial({
            color: 0xff4500,
            transparent: true,
            opacity: 0.9,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0.25, z);
        this.group.add(mesh);
        this.meshes.push({ mesh, mat });
    }

    update(delta) {
        this.timer -= delta;
        const progress = 1 - (this.timer / 0.5);

        for (const { mesh, mat } of this.meshes) {
            // Animate color: orange -> yellow -> white
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
    }

    hitsCell(x, z) {
        return this.cells.some(c => c.x === x && c.z === z);
    }

    dispose() {
        if (this.group.parent) this.group.parent.remove(this.group);
        for (const { mesh, mat } of this.meshes) {
            // Do NOT dispose geometry — it's shared
            mat.dispose();
        }
    }
}
