export class Player {
    constructor(id, color, keys) {
        this.id = id;
        this.color = color;
        this.keys = keys;

        // Stats
        this.bombRange = 1;
        this.maxBombs = 1;
        this.activeBombs = 0;
        this.speed = 4.0;
        this.alive = true;

        // Grid position
        this.gridX = 0;
        this.gridZ = 0;
        this.targetGridX = 0;
        this.targetGridZ = 0;
        this.moving = false;

        // 3D model
        this.model = this.createModel(color);
        this.model.castShadow = true;

        // Animation
        this.bobTime = 0;
        this.deathTimer = 0;
    }

    createModel(color) {
        const group = new THREE.Group();

        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.45, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.32;
        body.castShadow = true;
        group.add(body);

        // Head
        const headGeo = new THREE.SphereGeometry(0.18, 10, 10);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.7;
        head.castShadow = true;
        group.add(head);

        // Eyes
        const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.07, 0.73, 0.15);
        group.add(leftEye);
        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.07, 0.73, 0.15);
        group.add(rightEye);

        // Hat/helmet
        const hatGeo = new THREE.ConeGeometry(0.16, 0.22, 8);
        const hatMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
        const hat = new THREE.Mesh(hatGeo, hatMat);
        hat.position.y = 0.95;
        hat.castShadow = true;
        group.add(hat);

        // Feet (two small cylinders)
        const footGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.1, 6);
        const footMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const leftFoot = new THREE.Mesh(footGeo, footMat);
        leftFoot.position.set(-0.12, 0.05, 0);
        group.add(leftFoot);
        const rightFoot = new THREE.Mesh(footGeo, footMat);
        rightFoot.position.set(0.12, 0.05, 0);
        group.add(rightFoot);

        return group;
    }

    spawn(gridX, gridZ) {
        this.gridX = gridX;
        this.gridZ = gridZ;
        this.targetGridX = gridX;
        this.targetGridZ = gridZ;
        this.model.position.set(gridX, 0, gridZ);
        this.alive = true;
        this.deathTimer = 0;
        this.bombRange = 1;
        this.maxBombs = 1;
        this.activeBombs = 0;
        this.speed = 4.0;
        this.model.scale.set(1, 1, 1);
        this.model.visible = true;
    }

    update(delta, input, gridSystem) {
        if (!this.alive) {
            this.deathTimer -= delta;
            if (this.deathTimer > 0) {
                const s = Math.max(0, this.deathTimer / 0.5);
                this.model.scale.set(s, s, s);
                this.model.rotation.y += delta * 15;
            } else {
                this.model.visible = false;
            }
            return null; // no bomb action
        }

        let bombAction = null;

        // Check if at target
        const dx = this.targetGridX - this.model.position.x;
        const dz = this.targetGridZ - this.model.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.05) {
            // Snap to grid
            this.model.position.x = this.targetGridX;
            this.model.position.z = this.targetGridZ;
            this.gridX = this.targetGridX;
            this.gridZ = this.targetGridZ;
            this.moving = false;

            // Check new direction
            let mx = 0, mz = 0;
            if (input.isKeyDown(this.keys.LEFT))  mx = -1;
            else if (input.isKeyDown(this.keys.RIGHT)) mx = 1;
            if (input.isKeyDown(this.keys.UP))    mz = -1;
            else if (input.isKeyDown(this.keys.DOWN))  mz = 1;

            // Prioritize one direction
            if (mx !== 0 && mz !== 0) {
                // Prefer the most recently pressed, but just pick horizontal
                mz = 0;
            }

            if (mx !== 0 || mz !== 0) {
                const newX = this.gridX + mx;
                const newZ = this.gridZ + mz;
                if (gridSystem.isWalkable(newX, newZ)) {
                    this.targetGridX = newX;
                    this.targetGridZ = newZ;
                    this.moving = true;
                    // Face direction
                    this.model.rotation.y = Math.atan2(mx, mz);
                }
            }
        } else {
            // Move toward target
            const moveSpeed = this.speed * delta;
            const len = Math.max(dist, 0.001);
            const step = Math.min(moveSpeed, dist);
            this.model.position.x += (dx / len) * step;
            this.model.position.z += (dz / len) * step;
            this.moving = true;
        }

        // Walk bob animation
        if (this.moving) {
            this.bobTime += delta * this.speed * 3;
            this.model.position.y = Math.abs(Math.sin(this.bobTime)) * 0.06;
        } else {
            this.bobTime = 0;
            this.model.position.y = 0;
        }

        // Bomb placement
        if (input.wasKeyPressed(this.keys.BOMB)) {
            if (this.activeBombs < this.maxBombs) {
                bombAction = { gridX: this.gridX, gridZ: this.gridZ };
            }
        }

        return bombAction;
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        this.deathTimer = 0.5;
    }

    onBombExploded() {
        this.activeBombs = Math.max(0, this.activeBombs - 1);
    }

    applyPowerUp(type) {
        switch (type) {
            case 'bomb_range':
                this.bombRange = Math.min(this.bombRange + 1, 6);
                break;
            case 'extra_bomb':
                this.maxBombs = Math.min(this.maxBombs + 1, 5);
                break;
            case 'speed_boost':
                this.speed = Math.min(this.speed + 0.5, 6.0);
                break;
        }
    }
}
