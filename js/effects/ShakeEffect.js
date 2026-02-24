export class ShakeEffect {
    constructor(camera) {
        this.camera = camera;
        this.intensity = 0;
        this.decay = 5;
        this.basePosition = null;
    }

    shake(intensity = 0.15) {
        this.intensity = Math.max(this.intensity, intensity);
        if (!this.basePosition) {
            this.basePosition = this.camera.position.clone();
        }
    }

    update(delta) {
        if (this.intensity <= 0.001) {
            if (this.basePosition) {
                this.camera.position.copy(this.basePosition);
                this.basePosition = null;
            }
            this.intensity = 0;
            return;
        }

        this.intensity *= Math.exp(-this.decay * delta);

        if (this.basePosition) {
            this.camera.position.x = this.basePosition.x + (Math.random() - 0.5) * this.intensity;
            this.camera.position.y = this.basePosition.y + (Math.random() - 0.5) * this.intensity;
            this.camera.position.z = this.basePosition.z + (Math.random() - 0.5) * this.intensity;
        }
    }

    reset() {
        if (this.basePosition) {
            this.camera.position.copy(this.basePosition);
            this.basePosition = null;
        }
        this.intensity = 0;
    }
}
