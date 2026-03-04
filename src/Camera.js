export default class Camera {
    constructor(width, height) {
        this.x = 0;
        this.y = 0;
        this.width = width;
        this.height = height;
    }

    follow(target, mapWidth, mapHeight) {
        // Center on target
        this.x = target.x - this.width / 2;
        this.y = target.y - this.height / 2;

        // Clamp to map bounds
        this.x = Math.max(0, Math.min(this.x, mapWidth - this.width));
        this.y = Math.max(0, Math.min(this.y, mapHeight - this.height));
    }
}
