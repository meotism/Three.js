export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        document.body.insertBefore(this.renderer.domElement, document.body.firstChild);

        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(10, 15, 10);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.set(2048, 2048);
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 50;
        this.scene.add(this.directionalLight);

        window.addEventListener('resize', () => this.onResize());
    }

    positionCameraForMap(cols, rows) {
        const centerX = (cols - 1) / 2;
        const centerZ = (rows - 1) / 2;
        const maxDim = Math.max(cols, rows);
        const distance = maxDim * 1.2;

        this.camera.position.set(centerX, distance, centerZ + distance * 0.45);
        this.camera.lookAt(centerX, 0, centerZ + 1);

        // Update shadow camera bounds to cover map
        const half = maxDim * 0.7;
        this.directionalLight.shadow.camera.left = -half;
        this.directionalLight.shadow.camera.right = half;
        this.directionalLight.shadow.camera.top = half;
        this.directionalLight.shadow.camera.bottom = -half;
        this.directionalLight.position.set(centerX + 5, 15, centerZ - 5);
        this.directionalLight.target.position.set(centerX, 0, centerZ);
        this.scene.add(this.directionalLight.target);
        this.directionalLight.shadow.camera.updateProjectionMatrix();
    }

    positionCameraForMenu() {
        this.camera.position.set(6, 10, 14);
        this.camera.lookAt(6, 0, 5);
    }

    clearScene() {
        const toRemove = [];
        this.scene.traverse((child) => {
            if (child !== this.scene && child !== this.ambientLight &&
                child !== this.directionalLight && child !== this.directionalLight.target) {
                toRemove.push(child);
            }
        });
        toRemove.forEach((obj) => {
            if (obj.parent) obj.parent.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
