/**
 * OpponentAI — waypoint-following steering for AI-controlled cars.
 *
 * Strategy:
 *  1. Find the closest point on the track curve to the car's current position.
 *  2. Look ahead by LOOKAHEAD_T on the curve to get a target point.
 *  3. Compute the angle to that target in the car's local frame.
 *  4. Map to steer (-1 left, +1 right) using a simple proportional controller.
 *
 * This gives smooth, track-following behaviour without grid maps or tile lookups.
 */
export default class OpponentAI {
    /**
     * @param {Car} car
     * @param {Track} track
     * @param {number} skillMultiplier — 0…1, scales speed and steering precision
     */
    constructor(car, track, skillMultiplier = 0.8) {
        this.car = car;
        this.track = track;
        this.skill = skillMultiplier;

        // Lookahead: how far ahead on the curve to aim for (in t units, 0–1)
        this.LOOKAHEAD_T = 0.04 + Math.random() * 0.03; // varies per AI for diversity

        // Throttle throttle reduction when turning hard (cornering slow-down)
        this.corneringSensitivity = 0.6;
    }

    /**
     * Compute AI steer and throttle for this frame.
     * @returns {{ steer: number, throttle: number }}
     */
    update() {
        const car = this.car;
        const track = this.track;

        // 1. Find closest t on curve
        const t = track.getClosestT(car.pos);

        // 2. Look-ahead target
        const targetT = (t + this.LOOKAHEAD_T) % 1;
        const targetPt = track.getPointAt(targetT);

        // 3. Vector to target in world space
        const dx = targetPt.x - car.pos.x;
        const dz = targetPt.z - car.pos.z;

        // 4. Angle of target relative to car heading
        //    Car faces (sin(heading), 0, cos(heading))
        //    We need atan2 of (dx, dz) relative to current heading
        const worldAngle = Math.atan2(dx, dz);   // angle of target in world space
        let angleDiff = worldAngle - car.heading;

        // Normalise to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // 5. Proportional steer — positive angleDiff = target is to right → steer right = negative steer in car convention
        // Car convention: steer +1 = left (heading increases), steer -1 = right (heading decreases)
        // angleDiff > 0 = target is to right (clockwise) = steer right (-1)
        const steer = -Math.sign(angleDiff) * Math.min(Math.abs(angleDiff) / 0.5, 1.0) * this.skill;

        // 6. Throttle — reduce when turning sharply
        const turn = Math.abs(angleDiff);
        const throttle = turn < 0.3 ? 1 : Math.max(0.3, 1 - turn * this.corneringSensitivity);

        return { steer, throttle };
    }
}
