export const POWERUP_TYPES = [
    {
        id: 'bomb_range',
        name: 'Fire Up',
        color: 0xff6600,
        emissive: 0xff3300,
    },
    {
        id: 'extra_bomb',
        name: 'Bomb Up',
        color: 0x333333,
        emissive: 0x222222,
    },
    {
        id: 'speed_boost',
        name: 'Speed Up',
        color: 0xffff00,
        emissive: 0xaaaa00,
    },
];

export const DROP_CHANCE = 0.35;

export class PowerUp {
    constructor(gridX, gridZ, type) {
        this.gridX = gridX;
        this.gridZ = gridZ;
        this.type = type;
        this.collected = false;
        this.time = 0;

        this.model = this.createModel(type);
        this.model.position.set(gridX, 0.3, gridZ);
    }

    createModel(type) {
        const group = new THREE.Group();
        let geo;

        switch (type.id) {
            case 'bomb_range':
                geo = new THREE.ConeGeometry(0.15, 0.3, 6);
                break;
            case 'extra_bomb':
                geo = new THREE.SphereGeometry(0.15, 8, 8);
                break;
            case 'speed_boost':
                geo = new THREE.OctahedronGeometry(0.15);
                break;
            default:
                geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        }

        const mat = new THREE.MeshStandardMaterial({
            color: type.color,
            emissive: type.emissive,
            emissiveIntensity: 0.5,
            roughness: 0.3,
            metalness: 0.5,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        group.add(mesh);

        // Glow ring
        const ringGeo = new THREE.RingGeometry(0.2, 0.25, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: type.color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.01;
        group.add(ring);

        return group;
    }

    update(delta) {
        this.time += delta;
        // Rotate and bob
        this.model.rotation.y += delta * 2;
        this.model.position.y = 0.3 + Math.sin(this.time * 3) * 0.08;
    }

    collect() {
        this.collected = true;
    }

    dispose() {
        if (this.model.parent) this.model.parent.remove(this.model);
        this.model.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }

    static randomType() {
        return POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    }
}
