import * as THREE from 'three';

/**
 * Car — real arcade physics model.
 *
 * Physics model (top-down arcade):
 *  - Position: world XZ position (Y always = 0 on ground)
 *  - Heading: yaw angle in RADIANS, measured from world +X axis (standard math convention)
 *    - heading = 0 → car faces +X
 *    - heading = PI/2 → car faces -Z (Three.js +Z = towards viewer)
 *    We use heading directly for movement: vel = (cos(heading), 0, -sin(heading)) * speed
 *  - Speed: scalar, positive = forward, negative = reverse
 *  - Steering: heading changes when speed != 0
 *
 * Controls (player):
 *  - UP / DOWN = accelerate / brake
 *  - LEFT = turn left (heading increases — anti-clockwise when viewed from above)
 *  - RIGHT = turn right (heading decreases — clockwise)
 *
 * Collision: modelled as a sphere of radius `colliderRadius`.
 */
export default class Car {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Vector3} startPos  — spawn position (Y is ignored, set to 0)
     * @param {number} startHeading     — initial heading in radians
     * @param {number} colorHex         — body colour
     * @param {boolean} isPlayer
     * @param {THREE.Object3D|null} model  — optional GLB model
     */
    constructor(scene, startPos, startHeading = 0, colorHex = 0xff0055, isPlayer = false, model = null) {
        this.scene = scene;
        this.isPlayer = isPlayer;

        // ── Physics state ────────────────────────────────────────────────
        this.pos = new THREE.Vector3(startPos.x, 0, startPos.z);
        this.heading = startHeading; // radians (world yaw)
        this.speed = 0;           // current forward speed (units/s)

        // ── Tuning constants ─────────────────────────────────────────────
        this.maxSpeed = isPlayer ? 55 : 53;   // Increased overall speed
        this.maxReverse = 20;
        this.accel = isPlayer ? 75 : 70;   // High accel to overcome friction
        this.brakeForce = 90;
        this.friction = 0.98;  // much lower drag so cars can actually move fast
        this.turnSpeed = 1.35;  // Reduced from 2.4 so car doesn't spin 90 degrees instantly
        this.colliderRadius = 3.5;  // for car-car collision

        // ── Race tracking ────────────────────────────────────────────────
        this.lap = 0;
        this.checkpointT = 0;  // t value on spline for position tracking (0–1)
        this.totalDist = 0;  // monotonically increasing for placement ranking

        // ── Mesh ─────────────────────────────────────────────────────────
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.pos);
        scene.add(this.mesh);

        if (model) {
            this._buildFromModel(model);
        } else {
            this._buildProcedural(colorHex);
        }
    }

    // ─── Procedural geometry ──────────────────────────────────────────────────

    _buildFromModel(modelScene) {
        const clone = modelScene.clone(true);

        // Normalise size: longest horizontal extent → 10 units (scaled up from 7)
        const box = new THREE.Box3().setFromObject(clone);
        const size = box.getSize(new THREE.Vector3());
        const s = 10 / Math.max(size.x, size.z, 0.01);
        clone.scale.setScalar(s);

        // Re-compute bounding box after scale, center it and put base at Y=0
        const box2 = new THREE.Box3().setFromObject(clone);
        const ctr = box2.getCenter(new THREE.Vector3());
        clone.position.sub(ctr);
        clone.position.y = -box2.min.y * s; // lift so bottom at y=0

        clone.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
            }
        });

        this.mesh.add(clone);
    }

    _buildProcedural(colorHex) {
        const body = new THREE.MeshLambertMaterial({ color: colorHex });
        const black = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const tyre = new THREE.MeshLambertMaterial({ color: 0x222222 });

        const add = (geo, mat, x, y, z) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            m.castShadow = true;
            this.mesh.add(m);
            return m;
        };

        // Main body — elongated along Z (local forward = +Z in Three.js mesh space)
        // Scaled up ~1.5x manually
        add(new THREE.BoxGeometry(2.7, 1.05, 6.75), body, 0, 0.75, 0);
        add(new THREE.BoxGeometry(2.1, 0.9, 3.75), body, 0, 1.65, -0.45); // cockpit region
        add(new THREE.BoxGeometry(1.35, 0.75, 3.75), body, 0, 0.75, 4.2); // nose
        add(new THREE.BoxGeometry(6.75, 0.15, 1.5), body, 0, 0.6, 4.2); // front wing
        add(new THREE.BoxGeometry(4.5, 0.15, 1.2), body, 0, 2.7, -3.0); // rear wing
        add(new THREE.BoxGeometry(0.2, 1.95, 0.75), black, -1.25, 1.8, -3.0); // rear wing pillar L
        add(new THREE.BoxGeometry(0.2, 1.95, 0.75), black, 1.25, 1.8, -3.0); // rear wing pillar R

        // Wheels — CylinderGeometry, rotated so cylinder axis = X (lateral)
        const wheelGeo = new THREE.CylinderGeometry(1.2, 1.2, 1.05, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        [[-1, 3, 3.0], [1, 3, 3.0], [-1, 3, -2.7], [1, 3, -2.7]].forEach(([sx, , z]) => {
            add(wheelGeo, tyre, sx * 2.15, 0.9, z);
        });

        // Cockpit
        add(new THREE.BoxGeometry(1.05, 0.6, 1.5), black, 0, 2.15, -0.3);
    }

    // ─── Physics update ───────────────────────────────────────────────────────

    /**
     * Update physics for this frame.
     * @param {number} dt — delta time in seconds
     * @param {Object|null} keys — InputHandler.keys (null for AI)
     * @param {number|null} aiThrottle — -1 to 1 (null = use keys)
     * @param {number|null} aiSteer   — -1 (left) to 1 (right) (null = use keys)
     */
    update(dt, keys = null, aiThrottle = null, aiSteer = null) {
        // ── Determine throttle and steer inputs ──────────────────────────
        let throttle = 0;
        let steer = 0;

        if (keys !== null) {
            // Player input
            if (keys.up) throttle = 1;
            if (keys.down) throttle = -1;

            if (keys.left) steer = 1; // 1 increments heading = visually left on screen
            if (keys.right) steer = -1; // -1 decreases heading = visually right on screen
        } else {
            // AI input
            throttle = aiThrottle ?? 0;
            steer = aiSteer ?? 0;
        }

        // ── Acceleration / braking ───────────────────────────────────────
        if (throttle > 0) {
            this.speed += this.accel * dt;
        } else if (throttle < 0) {
            // Brake if moving forward, reverse if slow
            if (this.speed > 0.5) {
                this.speed -= this.brakeForce * dt;
            } else {
                this.speed -= this.accel * 0.5 * dt; // slower reverse
            }
        }

        // ── Friction ─────────────────────────────────────────────────────
        this.speed *= Math.pow(this.friction, dt * 60); // frame-rate independent

        // ── Speed clamp ──────────────────────────────────────────────────
        this.speed = Math.max(-this.maxReverse, Math.min(this.maxSpeed, this.speed));

        // ── Steering (only meaningful when moving) ───────────────────────
        if (Math.abs(this.speed) > 0.5) {
            // Car steers responsibly once it has SOME speed.
            const speedFactor = Math.abs(this.speed) > 10 ? 1.0 : (Math.abs(this.speed) / 10.0);
            const turnRate = this.turnSpeed * speedFactor;

            // Heading: left = negative rotation, right = positive
            this.heading += steer * turnRate * dt * Math.sign(this.speed);
        }

        // ── Move in heading direction ────────────────────────────────────
        // Forward direction = (sin(heading), 0, cos(heading))
        const dx = Math.sin(this.heading) * this.speed * dt;
        const dz = Math.cos(this.heading) * this.speed * dt;

        this.pos.x += dx;
        this.pos.z += dz;
        this.pos.y = 0; // always ground

        // ── Sync mesh ────────────────────────────────────────────────────
        this.mesh.position.copy(this.pos);
        // Correct 3D spatial alignment: mapping world heading to Three.js Y-rotation
        this.mesh.rotation.y = this.heading;
        this.mesh.position.y = 0;
    }

    destroy() {
        this.scene.remove(this.mesh);
    }
}
