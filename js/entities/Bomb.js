export class Bomb {
    constructor(gridX, gridZ, range, ownerId) {
        this.gridX = gridX;
        this.gridZ = gridZ;
        this.range = range;
        this.ownerId = ownerId;
        this.timer = 3.0;
        this.detonated = false;

        // 3D model
        this.model = this.createModel();
        this.model.position.set(gridX, 0.3, gridZ);

        this.initialScale = 1;
        this.pulseTime = 0;
    }

    createModel() {
        const group = new THREE.Group();

        // Bomb body
        const bodyGeo = new THREE.SphereGeometry(0.28, 12, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.3,
            metalness: 0.6,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);

        // Fuse
        const fuseGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.15, 6);
        const fuseMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const fuse = new THREE.Mesh(fuseGeo, fuseMat);
        fuse.position.y = 0.3;
        group.add(fuse);

        // Fuse tip (glowing)
        const tipGeo = new THREE.SphereGeometry(0.04, 6, 6);
        this.fuseTipMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
        const tip = new THREE.Mesh(tipGeo, this.fuseTipMat);
        tip.position.y = 0.38;
        group.add(tip);

        return group;
    }

    update(delta) {
        if (this.detonated) return true;

        this.timer -= delta;
        this.pulseTime += delta;

        // Pulsing animation — faster as timer decreases
        const pulseSpeed = 4 + (3 - this.timer) * 4;
        const pulseScale = 1 + 0.08 * Math.sin(this.pulseTime * pulseSpeed);
        this.model.scale.set(pulseScale, pulseScale, pulseScale);

        // Fuse tip flicker
        const flicker = Math.sin(this.pulseTime * pulseSpeed * 2) > 0;
        this.fuseTipMat.color.setHex(flicker ? 0xff6600 : 0xffaa00);

        if (this.timer <= 0) {
            return true; // ready to explode
        }
        return false;
    }

    detonate() {
        this.detonated = true;
    }

    dispose() {
        if (this.model.parent) this.model.parent.remove(this.model);
        this.model.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
