// 3D CAD Viewer using Three.js - V8
// V8 changes: tighter zoom/centering, matte (less shiny) material,
// optional explicit color override per model.

class CADViewer {
    constructor(container, colorSeed = null, explicitColor = null) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentModel = null;
        this.modelBounds = null;
        this.colorSeed = colorSeed;
        this.explicitColor = explicitColor; // e.g. 0x5dd8c4 — overrides palette/colorSeed if set
        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(6, 6, 6);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        this.setupLighting();
        this.setupControls();
        this.setupResize();
        this.animate();
        console.log('CAD Viewer V8 initialized');
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.3);
        directionalLight.position.set(10, 14, 8);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        directionalLight.shadow.bias = -0.0005;
        this.scene.add(directionalLight);
        const fillLight = new THREE.DirectionalLight(0xffeebb, 0.3);
        fillLight.position.set(-10, -10, -5);
        this.scene.add(fillLight);
        const hemiLight = new THREE.HemisphereLight(0xffeebb, 0x1a1a2e, 0.35);
        this.scene.add(hemiLight);
        const pointLight = new THREE.PointLight(0xffa500, 0.35); // dimmer, was 0.8 — was contributing to the "shiny" look
        pointLight.position.set(0, 5, 0);
        this.scene.add(pointLight);

        const shadowMat = new THREE.ShadowMaterial({ opacity: 0.18 });
        this.groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), shadowMat);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.position.y = -2.4;
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = false;
        this.controls.enableRotate = true;
        this.controls.autoRotate = false;
        this.controls.maxDistance = 50;
        this.controls.minDistance = 1;
        this.controls.target.set(0, 0, 0);
    }

    setupResize() {
        window.addEventListener('viewerResize', () => this.onWindowResize());
        setTimeout(() => this.onWindowResize(), 100);
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    loadModel(modelPath, onComplete) {
        console.log('Loading model:', modelPath);
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            this.currentModel = null;
        }
        const loader = new THREE.STLLoader();
        const self = this;
        loader.load(
            modelPath,
            function (geometry) {
                console.log('STL loaded via loader.load()');
                console.log('Vertices:', geometry.attributes.position.count);
                self.displayModel(geometry);
                if (onComplete) onComplete();
            },
            function (xhr) {
                console.log('Loading progress:', Math.round((xhr.loaded / xhr.total) * 100) + '%');
            },
            function (error) {
                console.error('Failed to load model:', modelPath, error);
                self.showErrorPlaceholder();
                if (onComplete) onComplete();
            }
        );
    }

    displayModel(geometry) {
        const modelColor = this.getModelColor();
        const material = new THREE.MeshPhongMaterial({
            color: modelColor,
            shininess: 18,                      // was 80 — much less glossy
            specular: new THREE.Color(0x0d0d0d), // was 0x333333 — dimmer highlight
            side: THREE.DoubleSide,
            flatShading: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        geometry.computeBoundingBox();
        const center = geometry.boundingBox.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);

        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        if (!isFinite(maxDimension) || maxDimension <= 0) {
            console.warn('Model has invalid/zero size, showing placeholder');
            this.showErrorPlaceholder();
            return;
        }

        this.displayedSize = 4;
        const scale = this.displayedSize / maxDimension;
        mesh.scale.setScalar(scale);

        this.scene.add(mesh);
        this.currentModel = mesh;
        this.fitCameraToModel();
        console.log('Model displayed, color: #' + modelColor.toString(16));
    }

    getModelColor() {
        if (this.explicitColor !== null && this.explicitColor !== undefined) {
            return this.explicitColor;
        }
        const palette = [
            0x3498db, 0x2ecc71, 0xe74c3c, 0x9b59b6,
            0xf39c12, 0x1abc9c, 0xe67e22, 0x34495e,
            0x27ae60, 0x8e44ad, 0xc0392b, 0x7f8c8d
        ];
        let index = 0;
        if (this.colorSeed !== null && this.colorSeed !== undefined) {
            index = Math.abs(this.colorSeed) % palette.length;
        } else {
            index = Math.floor(Math.random() * palette.length);
        }
        return palette[index];
    }

    fitCameraToModel() {
        if (!this.currentModel) return;

        const displayedSize = this.displayedSize || 4;
        this.controls.target.set(0, 0, 0);

        const fov = this.camera.fov * (Math.PI / 180);
        const radius = (displayedSize * Math.sqrt(3)) / 2;
        const distance = (radius / Math.sin(fov / 2)) * 0.55; // was 0.7 — more zoomed in

        const dir = new THREE.Vector3(1, 0.8, 1).normalize();
        this.camera.position.copy(dir.multiplyScalar(distance));
        this.camera.lookAt(0, 0, 0);

        this.controls.maxDistance = distance * 3;
        this.controls.minDistance = distance * 0.4;
        this.controls.update();
    }

    showErrorPlaceholder() {
        if (this.currentModel) this.scene.remove(this.currentModel);
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshPhongMaterial({ color: 0xff6b6b, wireframe: true });
        const cube = new THREE.Mesh(geometry, material);
        this.scene.add(cube);
        this.currentModel = cube;
        console.error('Error placeholder shown');
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    dispose() {
        if (this.renderer) this.renderer.dispose();
        if (this.controls) this.controls.dispose();
    }
}