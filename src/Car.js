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
        this.maxSpeed = isPlayer ? 40 : 35;   // units/s
        this.maxReverse = 15;
        this.accel = isPlayer ? 22 : 18;   // units/s²
        this.brakeForce = 35;
        this.friction = 0.92;  // multiplicative per frame (applied to speed)
        this.turnSpeed = 1.8;   // radians/s at full speed (scales with speed)
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

        // Normalise size: longest horizontal extent → 7 units
        const box = new THREE.Box3().setFromObject(clone);
        const size = box.getSize(new THREE.Vector3());
        const s = 7 / Math.max(size.x, size.z, 0.01);
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
        add(new THREE.BoxGeometry(1.8, 0.7, 4.5), body, 0, 0.5, 0);
        add(new THREE.BoxGeometry(1.4, 0.6, 2.5), body, 0, 1.1, -0.3); // cockpit region
        add(new THREE.BoxGeometry(0.9, 0.5, 2.5), body, 0, 0.5, 2.8); // nose
        add(new THREE.BoxGeometry(4.5, 0.1, 1.0), body, 0, 0.4, 2.8); // front wing
        add(new THREE.BoxGeometry(3.0, 0.1, 0.8), body, 0, 1.8, -2.0); // rear wing
        add(new THREE.BoxGeometry(0.15, 1.3, 0.5), black, -0.85, 1.2, -2.0); // rear wing pillar L
        add(new THREE.BoxGeometry(0.15, 1.3, 0.5), black, 0.85, 1.2, -2.0); // rear wing pillar R

        // Wheels — CylinderGeometry, rotated so cylinder axis = X (lateral)
        const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.7, 16);
        wheelGeo.rotateZ(Math.PI / 2);
        [[-1, 3, 2.0], [1, 3, 2.0], [-1, 3, -1.8], [1, 3, -1.8]].forEach(([sx, , z]) => {
            add(wheelGeo, tyre, sx * 1.45, 0.6, z);
        });

        // Cockpit
        add(new THREE.BoxGeometry(0.7, 0.4, 1.0), black, 0, 1.45, -0.2);
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
            if (keys.left) steer = 1;  //  +1 = left = heading increases = anti-clockwise
            if (keys.right) steer = -1;  //  -1 = right = heading decreases = clockwise
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
            // Turn rate scales with speed (tighter turn at low speed for realism)
            const speedFactor = Math.min(Math.abs(this.speed) / this.maxSpeed, 1.0);
            const turnRate = this.turnSpeed * speedFactor;

            // Heading: left = positive rotation (anti-clockwise viewed from above)
            this.heading += steer * turnRate * dt * Math.sign(this.speed);
        }

        // ── Move in heading direction ────────────────────────────────────
        // In Three.js: +X = right, +Z = toward camera.
        // We define heading=0 as facing +Z (camera direction).
        // heading increases anti-clockwise (left turn).
        //   Forward direction = (sin(heading), 0, cos(heading))  ... classic game convention
        const dx = Math.sin(this.heading) * this.speed * dt;
        const dz = Math.cos(this.heading) * this.speed * dt;

        this.pos.x += dx;
        this.pos.z += dz;
        this.pos.y = 0; // always ground

        // ── Sync mesh ────────────────────────────────────────────────────
        this.mesh.position.copy(this.pos);
        // Car model: Three.js mesh default forward = +Z. Rotate by heading.
        // Heading = 0 → face +Z, heading = PI/2 → face +X (right)
        // mesh.rotation.y rotates anti-clockwise in world space, so:
        //   mesh.rotation.y = -heading  (because rotating the mesh CW undoes the CCW heading)
        this.mesh.rotation.y = -this.heading;
        this.mesh.position.y = 0;
    }

    destroy() {
        this.scene.remove(this.mesh);
    }
}
