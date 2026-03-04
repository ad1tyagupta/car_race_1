import * as THREE from 'three';
import Car from './Car.js';
import Track from './Track.js';
import InputHandler from './Input.js';
import MAPS from './maps.js';
import OpponentAI from './OpponentAI.js';

/**
 * Game — master orchestrator.
 *
 * Responsibilities:
 *  - Spawn/destroy track and cars
 *  - Run physics update loop (dt-based)
 *  - Car–car collision detection and response (sphere vs sphere)
 *  - AI steering updates
 *  - Lap / progress tracking
 *  - Camera follow (smooth chase-cam behind player)
 *  - HUD updates
 */
export default class Game {
    constructor(scene, camera, renderer, assetLoader) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.assets = assetLoader;
        this.input = new InputHandler();

        this.state = 'MENU';
        this.track = null;
        this.player = null;
        this.opponents = [];
        this.ais = [];
        this.totalLaps = 3;

        // Timing
        this._lastTime = null;
        this._startTime = null;
        this._finishTime = null;

        // Camera jitter prevention
        this._camTarget = new THREE.Vector3();
        this._camLookAt = new THREE.Vector3();
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    start(mapId) {
        this._destroyCurrentLevel();

        const mapDef = MAPS[mapId];
        this.track = new Track(this.scene, mapDef);

        // ── Player ──
        const startPt = this.track.getPointAt(0);
        const startTan = this.track.getTangentAt(0);
        // Heading so car faces direction of travel at t=0
        const startHeading = Math.atan2(startTan.x, startTan.z);

        const playerModel = this.assets.get('car1');
        this.player = new Car(this.scene, startPt, startHeading, 0xff0055, true, playerModel);
        this.player.speed = 0;

        // ── Opponents ──
        const carModels = ['car1', 'car2', 'car3'];
        const opColors = [0x00d2ff, 0x00ff88, 0xffaa00, 0xaa00ff, 0xff6600];
        const skillLvls = [0.85, 0.90, 0.95, 0.88, 0.82]; // Increased base skill

        for (let i = 1; i <= 5; i++) {
            // Spawn opponents slightly AHEAD of the start line
            const t = (i * 0.012) % 1;
            const pt = this.track.getPointAt(t);
            const tan = this.track.getTangentAt(t);
            const heading = Math.atan2(tan.x, tan.z);

            // Small lateral stagger so cars don't stack
            const lateralOff = (i % 2 === 0 ? 3 : -3);
            pt.x += Math.cos(heading) * lateralOff;
            pt.z -= Math.sin(heading) * lateralOff;

            const modelKey = carModels[i % carModels.length];
            const model = this.assets.get(modelKey);
            const car = new Car(this.scene, pt, heading, opColors[i - 1], false, model);
            car.speed = 0;

            const ai = new OpponentAI(car, this.track, skillLvls[i - 1]);
            this.opponents.push(car);
            this.ais.push(ai);
        }

        this.state = 'PLAY';
        this._lastTime = performance.now();
        this._startTime = performance.now();
    }

    // ── Per-frame update ───────────────────────────────────────────────────────

    update() {
        if (this.state !== 'PLAY') return;

        // ── Delta time ──
        const now = performance.now();
        let dt = (now - this._lastTime) / 1000; // seconds
        this._lastTime = now;
        dt = Math.min(dt, 0.05); // cap at 50ms to avoid spiral of death

        // ── Player physics ──
        this.player.update(dt, this.input.keys);

        // ── AI physics ──
        for (let i = 0; i < this.opponents.length; i++) {
            const { steer, throttle } = this.ais[i].update();
            this.opponents[i].update(dt, null, throttle, steer);
        }

        // ── Collision detection (car vs car) ──
        const allCars = [this.player, ...this.opponents];
        this._resolveCollisions(allCars);

        // ── Lap progress ──
        this._updateProgress(this.player, dt);
        for (const opp of this.opponents) this._updateProgress(opp, dt);

        // ── Camera ──
        this._updateCamera(dt);

        // ── HUD ──
        this._updateHUD();
    }

    // ── Collision resolution ──────────────────────────────────────────────────

    _resolveCollisions(cars) {
        for (let a = 0; a < cars.length; a++) {
            for (let b = a + 1; b < cars.length; b++) {
                const ca = cars[a];
                const cb = cars[b];

                const dx = cb.pos.x - ca.pos.x;
                const dz = cb.pos.z - ca.pos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const minD = ca.colliderRadius + cb.colliderRadius;

                if (dist < minD && dist > 0.001) {
                    // Overlap amount
                    const overlap = minD - dist;
                    // Normalised push direction
                    const nx = dx / dist;
                    const nz = dz / dist;

                    // Separate them (push each car half the overlap)
                    const push = overlap * 0.5;
                    ca.pos.x -= nx * push;
                    ca.pos.z -= nz * push;
                    cb.pos.x += nx * push;
                    cb.pos.z += nz * push;

                    // Exchange velocity components along collision normal
                    // (elastic collision approximation — swap projected speeds)
                    const vaLong = ca.speed * Math.cos(ca.heading - Math.atan2(nx, nz));
                    const vbLong = cb.speed * Math.cos(cb.heading - Math.atan2(nx, nz));

                    const restitution = 0.4;
                    const impulse = (vaLong - vbLong) * restitution;

                    ca.speed -= impulse * 0.5;
                    cb.speed += impulse * 0.5;

                    // Sync mesh positions
                    ca.mesh.position.copy(ca.pos);
                    cb.mesh.position.copy(cb.pos);
                }
            }
        }
    }

    // ── Progress / lap tracking ───────────────────────────────────────────────

    _updateProgress(car, dt) {
        // Project car onto track to get current t
        const t = this.track.getClosestT(car.pos);

        // Detect lap crossing: t jumps from ~1 back to ~0
        const prev = car.checkpointT;
        const curr = t;

        // Check for lap completion (crossing from near 1 to near 0)
        if (prev > 0.85 && curr < 0.15) {
            car.lap++;
            if (car.isPlayer && car.lap >= this.totalLaps) {
                this._finishGame();
            }
        }

        car.checkpointT = curr;
        car.totalDist = car.lap + curr; // sortable key for placement
    }

    // ── Chase camera ──────────────────────────────────────────────────────────

    _updateCamera(dt) {
        const car = this.player;

        // Camera position: behind and above the car, always following heading
        const behindX = car.pos.x - Math.sin(car.heading) * 25;
        const behindZ = car.pos.z - Math.cos(car.heading) * 25;
        const idealCamPos = new THREE.Vector3(behindX, 14, behindZ);

        // Smooth lerp
        this._camTarget.lerp(idealCamPos, Math.min(1, 5 * dt));
        this.camera.position.copy(this._camTarget);

        // Look at a point slightly ahead of the car
        const aheadX = car.pos.x + Math.sin(car.heading) * 10;
        const aheadZ = car.pos.z + Math.cos(car.heading) * 10;
        const lookAt = new THREE.Vector3(aheadX, 0, aheadZ);
        this._camLookAt.lerp(lookAt, Math.min(1, 8 * dt));
        this.camera.lookAt(this._camLookAt);
    }

    // ── HUD ───────────────────────────────────────────────────────────────────

    _updateHUD() {
        // Placement
        const allCars = [this.player, ...this.opponents];
        allCars.sort((a, b) => b.totalDist - a.totalDist);
        const place = allCars.indexOf(this.player) + 1;

        document.getElementById('pos-val').innerText = `${place}/${allCars.length}`;
        document.getElementById('lap-val').innerText = `${Math.min(this.player.lap + 1, this.totalLaps)}/${this.totalLaps}`;
        document.getElementById('speed-val').innerText = Math.round(Math.abs(this.player.speed));
    }

    // ── Finish ────────────────────────────────────────────────────────────────

    _finishGame() {
        this.state = 'GAMEOVER';
        const elapsed = (performance.now() - this._startTime) / 1000;
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toFixed(2).padStart(5, '0');

        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');

        const allCars = [this.player, ...this.opponents];
        allCars.sort((a, b) => b.totalDist - a.totalDist);
        const place = allCars.indexOf(this.player) + 1;

        document.getElementById('final-place').innerText = `${place} / ${allCars.length}`;
        document.getElementById('final-time').innerText = `${mins}:${secs}`;
    }

    reset() {
        this.state = 'MENU';
        this._destroyCurrentLevel();
    }

    _destroyCurrentLevel() {
        if (this.track) { this.track.destroy(); this.track = null; }
        if (this.player) { this.player.destroy(); this.player = null; }
        this.opponents.forEach(c => c.destroy());
        this.opponents = [];
        this.ais = [];
    }
}
