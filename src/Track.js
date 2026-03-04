import * as THREE from 'three';

/**
 * Track — builds a flat ribbon road mesh along a CatmullRomCurve3.
 * 
 * Architecture:
 *  - Road surface: flat BufferGeometry ribbon at Y=0 on the XZ plane
 *  - Kerbs: thin raised strips along both edges (red/white alternating)
 *  - Grass: large PlaneGeometry beneath everything at Y=-0.05
 *  - Curve: CatmullRomCurve3 for car positioning queries (getPointAt / getTangentAt)
 * 
 * NO ExtrudeGeometry is used — it creates a Frenet-twisted mess with 3D curves.
 */
export default class Track {
    /**
     * @param {THREE.Scene} scene
     * @param {Object} mapDef  — { name, points: THREE.Vector3[] }
     */
    constructor(scene, mapDef) {
        this.scene = scene;
        this.roadWidth = 22;   // full road width in world units
        this.segments = 400;  // mesh smoothness

        // Build closed spline
        this.curve = new THREE.CatmullRomCurve3(mapDef.points, true, 'catmullrom', 0.5);

        // Cache a dense sample of points for fast track queries
        this._sampleCount = 1000;
        this._samples = this.curve.getPoints(this._sampleCount);

        this.group = new THREE.Group();
        this._buildGrass();
        this._buildRoad();
        this._buildKerbs();
        scene.add(this.group);
    }

    // ─── Mesh builders ────────────────────────────────────────────────────────

    _buildGrass() {
        const geo = new THREE.PlaneGeometry(3000, 3000);
        const mat = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = -0.05;
        mesh.receiveShadow = true;
        this.group.add(mesh);
    }

    _buildRoad() {
        const { verts, uvs, indices } = this._buildRibbon(this.roadWidth, 0);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mat = new THREE.MeshLambertMaterial({ color: 0x404040 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        mesh.position.y = 0;
        this.group.add(mesh);
    }

    _buildKerbs() {
        // Left kerb (outer) at +halfRoad, Right kerb at -halfRoad
        const kerbWidth = 2;
        const kerbHeight = 0.25;

        for (const side of [-1, 1]) {
            const offset = side * (this.roadWidth / 2 + kerbWidth / 2);
            const { verts, uvs, indices } = this._buildRibbon(kerbWidth, offset, kerbHeight);
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geo.setIndex(indices);
            geo.computeVertexNormals();

            // Alternating red/white kerb using a checker pattern via vertex color is complex,
            // so we use red for simplicity
            const mat = new THREE.MeshLambertMaterial({ color: 0xcc2200, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.y = 0;
            this.group.add(mesh);
        }
    }

    /**
     * Build a flat ribbon mesh along this.curve.
     * @param {number} width - ribbon width
     * @param {number} lateralOffset - lateral shift from curve centerline
     * @param {number} height - Y height of the ribbon
     */
    _buildRibbon(width, lateralOffset = 0, height = 0) {
        const N = this.segments;
        const half = width / 2;
        const verts = [];
        const uvs = [];
        const indices = [];

        for (let i = 0; i <= N; i++) {
            const t = i / N;
            const point = this.curve.getPointAt(t);
            const tangent = this.curve.getTangentAt(t);

            // right = tangent × world-up (flat, no Y component)
            const worldUp = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();

            // Center of this ribbon cross-section
            const center = point.clone().add(right.clone().multiplyScalar(lateralOffset));
            center.y = height;

            // Left and right edge
            const L = center.clone().sub(right.clone().multiplyScalar(half));
            const R = center.clone().add(right.clone().multiplyScalar(half));

            verts.push(L.x, L.y, L.z, R.x, R.y, R.z);
            uvs.push(0, t, 1, t);

            if (i < N) {
                const b = i * 2;
                // Two triangles per quad
                indices.push(b, b + 1, b + 2);
                indices.push(b + 1, b + 3, b + 2);
            }
        }
        return { verts, uvs, indices };
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /** Get world-space position at normalised t ∈ [0,1) */
    getPointAt(t) {
        return this.curve.getPointAt(((t % 1) + 1) % 1);
    }

    /** Get normalised tangent at t — points in direction of travel */
    getTangentAt(t) {
        return this.curve.getTangentAt(((t % 1) + 1) % 1);
    }

    /**
     * Given a world-space position, return the closest t value on the curve.
     * Uses a pre-sampled cache for speed.
     * @param {THREE.Vector3} position
     * @returns {number} t ∈ [0,1)
     */
    getClosestT(position) {
        let best = 0;
        let minDst = Infinity;
        for (let i = 0; i <= this._sampleCount; i++) {
            const s = this._samples[i];
            const dst = position.distanceToSquared(s);
            if (dst < minDst) {
                minDst = dst;
                best = i / this._sampleCount;
            }
        }
        return best;
    }

    destroy() {
        this.scene.remove(this.group);
    }
}
