// 3D CAD Viewer using Three.js - V9
// Preserves V8 colors and matte styling.
// Adds safe animation, loading, resize, and resource cleanup.

class CADViewer {
    constructor(container, colorSeed = null, explicitColor = null) {
        this.container = container;
        this.colorSeed = colorSeed;
        this.explicitColor = explicitColor;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentModel = null;
        this.modelBounds = null;
        this.groundPlane = null;

        this.disposed = false;
        this.animationFrameId = null;
        this.resizeObserver = null;
        this.resizeTimeout = null;
        this.loadVersion = 0;

        this.handleResize = () => this.onWindowResize();
        this.handleContextLost = event => {
            event.preventDefault();
            this.stopAnimation();
        };
        this.handleContextRestored = () => {
            if (this.disposed) return;
            this.onWindowResize();
            this.animate();
        };

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        const width = Math.max(this.container.clientWidth, 1);
        const height = Math.max(this.container.clientHeight, 1);

        this.camera = new THREE.PerspectiveCamera(
            75,
            width / height,
            0.1,
            1000
        );
        this.camera.position.set(6, 6, 6);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });

        this.renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, 1.5)
        );
        this.renderer.setSize(width, height);

        // Shadows are disabled to reduce per-viewer GPU overhead.
        this.renderer.shadowMap.enabled = false;

        this.renderer.domElement.style.display = 'block';
        this.container.appendChild(this.renderer.domElement);

        this.renderer.domElement.addEventListener(
            'webglcontextlost',
            this.handleContextLost,
            false
        );
        this.renderer.domElement.addEventListener(
            'webglcontextrestored',
            this.handleContextRestored,
            false
        );

        this.setupLighting();
        this.setupControls();
        this.setupResize();
        this.animate();
    }

    setupLighting() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));

        const directionalLight = new THREE.DirectionalLight(
            0xffffff,
            1.3
        );
        directionalLight.position.set(10, 14, 8);
        this.scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xffeebb, 0.3);
        fillLight.position.set(-10, -10, -5);
        this.scene.add(fillLight);

        this.scene.add(
            new THREE.HemisphereLight(0xffeebb, 0x1a1a2e, 0.35)
        );

        const pointLight = new THREE.PointLight(0xffa500, 0.35);
        pointLight.position.set(0, 5, 0);
        this.scene.add(pointLight);
    }

    setupControls() {
        this.controls = new THREE.OrbitControls(
            this.camera,
            this.renderer.domElement
        );

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
        window.addEventListener('viewerResize', this.handleResize);
        window.addEventListener('resize', this.handleResize);

        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(this.handleResize);
            this.resizeObserver.observe(this.container);
        }

        this.resizeTimeout = setTimeout(this.handleResize, 100);
    }

    onWindowResize() {
        if (this.disposed || !this.camera || !this.renderer) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        if (width <= 0 || height <= 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    loadModel(modelPath, onComplete) {
        if (this.disposed) return;

        // Ignore callbacks from earlier loads or disposed viewers.
        const version = ++this.loadVersion;

        this.clearCurrentModel();

        const loader = new THREE.STLLoader();

        loader.load(
            modelPath,
            geometry => {
                if (this.disposed || version !== this.loadVersion) {
                    geometry.dispose();
                    return;
                }

                try {
                    this.displayModel(geometry);
                } catch (error) {
                    geometry.dispose();
                    console.error(
                        'Failed to display model:',
                        modelPath,
                        error
                    );
                    this.showErrorPlaceholder();
                }

                if (!this.disposed && typeof onComplete === 'function') {
                    onComplete();
                }
            },
            undefined,
            error => {
                if (this.disposed || version !== this.loadVersion) return;

                console.error('Failed to load model:', modelPath, error);
                this.showErrorPlaceholder();

                if (typeof onComplete === 'function') {
                    onComplete();
                }
            }
        );
    }

    displayModel(geometry) {
        if (this.disposed) {
            geometry.dispose();
            return;
        }

        const position = geometry.getAttribute('position');

        if (!position || position.count === 0) {
            geometry.dispose();
            this.showErrorPlaceholder();
            return;
        }

        geometry.computeBoundingBox();

        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);

        if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
            geometry.dispose();
            this.showErrorPlaceholder();
            return;
        }

        const center = geometry.boundingBox.getCenter(
            new THREE.Vector3()
        );

        geometry.translate(-center.x, -center.y, -center.z);

        if (!geometry.getAttribute('normal')) {
            geometry.computeVertexNormals();
        }

        const material = new THREE.MeshPhongMaterial({
            color: this.getModelColor(),
            shininess: 18,
            specular: new THREE.Color(0x0d0d0d),
            side: THREE.DoubleSide,
            flatShading: false
        });

        const mesh = new THREE.Mesh(geometry, material);

        this.displayedSize = 4;
        mesh.scale.setScalar(this.displayedSize / maxDimension);

        this.clearCurrentModel();
        this.scene.add(mesh);
        this.currentModel = mesh;

        this.fitCameraToModel();
    }

    getModelColor() {
        if (
            this.explicitColor !== null &&
            this.explicitColor !== undefined
        ) {
            return this.explicitColor;
        }

        const palette = [
            0x3498db, 0x2ecc71, 0xe74c3c, 0x9b59b6,
            0xf39c12, 0x1abc9c, 0xe67e22, 0x34495e,
            0x27ae60, 0x8e44ad, 0xc0392b, 0x7f8c8d
        ];

        if (this.colorSeed !== null && this.colorSeed !== undefined) {
            const seed = Number(this.colorSeed);

            if (Number.isFinite(seed)) {
                return palette[
                    Math.abs(Math.trunc(seed)) % palette.length
                ];
            }
        }

        return palette[Math.floor(Math.random() * palette.length)];
    }

    fitCameraToModel() {
        if (this.disposed || !this.currentModel) return;

        this.onWindowResize();

        this.currentModel.updateMatrixWorld(true);

        this.modelBounds = new THREE.Box3().setFromObject(
            this.currentModel
        );

        const sphere = this.modelBounds.getBoundingSphere(
            new THREE.Sphere()
        );

        if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) {
            return;
        }

        const verticalFov = this.camera.fov * Math.PI / 180;
        const horizontalFov = 2 * Math.atan(
            Math.tan(verticalFov / 2) * this.camera.aspect
        );

        const limitingFov = Math.min(verticalFov, horizontalFov);
        const distance = (
            sphere.radius / Math.sin(limitingFov / 2)
        ) * 1.05;

        const direction = new THREE.Vector3(1, 0.8, 1).normalize();

        this.controls.target.copy(sphere.center);
        this.camera.position
            .copy(sphere.center)
            .addScaledVector(direction, distance);

        this.camera.near = 0.01;
        this.camera.far = Math.max(1000, distance * 10);
        this.camera.updateProjectionMatrix();
        this.camera.lookAt(sphere.center);

        this.controls.maxDistance = distance * 3;
        this.controls.minDistance = Math.max(
            sphere.radius * 0.3,
            0.1
        );
        this.controls.update();
    }

    showErrorPlaceholder() {
        if (this.disposed) return;

        this.clearCurrentModel();

        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshPhongMaterial({
            color: 0xff6b6b,
            wireframe: true
        });

        this.currentModel = new THREE.Mesh(geometry, material);
        this.scene.add(this.currentModel);
        this.fitCameraToModel();
    }

    disposeObject(object) {
        if (!object) return;

        object.traverse(child => {
            if (child.geometry) {
                child.geometry.dispose();
            }

            if (child.material) {
                const materials = Array.isArray(child.material)
                    ? child.material
                    : [child.material];

                materials.forEach(material => material.dispose());
            }
        });
    }

    clearCurrentModel() {
        if (!this.currentModel) return;

        if (this.scene) {
            this.scene.remove(this.currentModel);
        }

        this.disposeObject(this.currentModel);
        this.currentModel = null;
        this.modelBounds = null;
    }

    animate() {
        if (
            this.disposed ||
            !this.renderer ||
            this.animationFrameId !== null
        ) {
            return;
        }

        const frame = () => {
            this.animationFrameId = null;

            if (this.disposed || !this.renderer) return;

            if (this.renderer.getContext().isContextLost()) return;

            if (this.controls) {
                this.controls.update();
            }

            this.renderer.render(this.scene, this.camera);
            this.animationFrameId = requestAnimationFrame(frame);
        };

        this.animationFrameId = requestAnimationFrame(frame);
    }

    stopAnimation() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    dispose() {
        if (this.disposed) return;

        this.disposed = true;
        this.loadVersion++;

        this.stopAnimation();
        clearTimeout(this.resizeTimeout);

        window.removeEventListener('viewerResize', this.handleResize);
        window.removeEventListener('resize', this.handleResize);

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        this.clearCurrentModel();

        if (this.scene) {
            this.disposeObject(this.scene);
            this.scene.clear();
        }

        if (this.renderer) {
            const canvas = this.renderer.domElement;

            canvas.removeEventListener(
                'webglcontextlost',
                this.handleContextLost
            );
            canvas.removeEventListener(
                'webglcontextrestored',
                this.handleContextRestored
            );

            this.renderer.dispose();
            this.renderer.forceContextLoss();
            canvas.remove();

            this.renderer = null;
        }

        this.scene = null;
        this.camera = null;
        this.groundPlane = null;
    }
}

window.CADViewer = CADViewer;