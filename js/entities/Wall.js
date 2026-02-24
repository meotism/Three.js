// Shared geometry and material for walls
let _wallGeo = null;

function getWallGeometry() {
    if (!_wallGeo) _wallGeo = new THREE.BoxGeometry(0.95, 1.0, 0.95);
    return _wallGeo;
}

export class Wall {
    constructor(x, z, color = 0x4a4a5a) {
        this.gridX = x;
        this.gridZ = z;

        this.mesh = new THREE.Mesh(
            getWallGeometry(),
            new THREE.MeshStandardMaterial({
                color,
                roughness: 0.85,
                metalness: 0.1,
            })
        );
        this.mesh.position.set(x, 0.5, z);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }
}
