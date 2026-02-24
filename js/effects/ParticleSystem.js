export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    emit(x, y, z, count = 20, color = 0xff6600) {
        for (let i = 0; i < count; i++) {
            const geo = new THREE.SphereGeometry(0.04 + Math.random() * 0.04, 4, 4);
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 1,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);

            const vel = {
                x: (Math.random() - 0.5) * 4,
                y: Math.random() * 4 + 1,
                z: (Math.random() - 0.5) * 4,
            };

            this.scene.add(mesh);
            this.particles.push({
                mesh,
                mat,
                vel,
                life: 0.5 + Math.random() * 0.3,
                maxLife: 0.5 + Math.random() * 0.3,
            });
        }

        // Cap total particles
        while (this.particles.length > 200) {
            const old = this.particles.shift();
            this.scene.remove(old.mesh);
            old.mesh.geometry.dispose();
            old.mat.dispose();
        }
    }

    update(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= delta;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mat.dispose();
                this.particles.splice(i, 1);
                continue;
            }

            // Physics
            p.vel.y -= 9.8 * delta;
            p.mesh.position.x += p.vel.x * delta;
            p.mesh.position.y += p.vel.y * delta;
            p.mesh.position.z += p.vel.z * delta;

            // Fade
            const t = p.life / p.maxLife;
            p.mat.opacity = t;
            const s = t * 0.8 + 0.2;
            p.mesh.scale.set(s, s, s);

            // Floor collision
            if (p.mesh.position.y < 0) {
                p.mesh.position.y = 0;
                p.vel.y *= -0.3;
                p.vel.x *= 0.8;
                p.vel.z *= 0.8;
            }
        }
    }

    clear() {
        for (const p of this.particles) {
            this.scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mat.dispose();
        }
        this.particles = [];
    }
}
