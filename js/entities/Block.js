let _blockGeo = null;

function getBlockGeometry() {
    if (!_blockGeo) _blockGeo = new THREE.BoxGeometry(0.9, 0.85, 0.9);
    return _blockGeo;
}

export class Block {
    constructor(x, z, color = 0x8B6914) {
        this.gridX = x;
        this.gridZ = z;
        this.alive = true;
        this.destroyTimer = 0;

        this.mesh = new THREE.Mesh(
            getBlockGeometry(),
            new THREE.MeshStandardMaterial({
                color,
                roughness: 0.7,
                metalness: 0.0,
            })
        );
        this.mesh.position.set(x, 0.425, z);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
    }

    destroy() {
        this.alive = false;
        this.destroyTimer = 0.3;
    }

    update(delta) {
        if (!this.alive && this.destroyTimer > 0) {
            this.destroyTimer -= delta;
            const scale = Math.max(0, this.destroyTimer / 0.3);
            this.mesh.scale.set(scale, scale, scale);
            this.mesh.position.y = 0.425 * scale;
            if (this.destroyTimer <= 0) {
                return true; // signal removal
            }
        }
        return false;
    }

    dispose() {
        if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
        this.mesh.material.dispose();
    }
}
