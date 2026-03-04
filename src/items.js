import * as THREE from 'three';

export default class ItemSystem {
    constructor(scene, track) {
        this.scene = scene;
        this.track = track;
        this.items = [];

        const boxGeo = new THREE.BoxGeometry(3, 3, 3);
        const boxMat = new THREE.MeshPhongMaterial({ color: 0xffff00, specular: 0xffffff, shininess: 50 });

        // Spawn items
        this.spawnTimer = 0;

        // Procedural spawn
        // Find road tiles
        this.validTiles = [];
        const rows = this.track.mapData.length;
        const cols = this.track.mapData[0].length;
        const tileSize = this.track.tileSize;

        const offsetX = (cols * tileSize) / 2;
        const offsetZ = (rows * tileSize) / 2;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (this.track.mapData[r][c] === 0) {
                    this.validTiles.push({
                        x: c * tileSize - offsetX,
                        z: r * tileSize - offsetZ
                    });
                }
            }
        }

        // Initial spawn
        for (let i = 0; i < 10; i++) this.spawnRandom();
    }

    spawnRandom() {
        if (this.items.length > 20) return;
        const tile = this.validTiles[Math.floor(Math.random() * this.validTiles.length)];
        // Add random offset within tile
        const x = tile.x + (Math.random() - 0.5) * 10;
        const z = tile.z + (Math.random() - 0.5) * 10;

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshPhongMaterial({ color: 0xffff00 }));
        mesh.position.set(x, 3, z);
        mesh.active = true;
        mesh.castShadow = true;
        this.scene.add(mesh);

        this.items.push(mesh);
    }

    update(cars) {
        const time = Date.now() * 0.002;

        // Floating animation
        this.items.forEach(item => {
            if (!item.active) return;
            item.rotation.y += 0.02;
            item.position.y = 3 + Math.sin(time + item.position.x) * 1;

            // Collision with cars
            const itemBox = new THREE.Box3().setFromObject(item);
            cars.forEach(car => {
                if (itemBox.intersectsBox(car.collider)) {
                    // Pick up!
                    item.active = false;
                    item.visible = false; // Hide for reuse or dispose

                    // Logic for granting item to car (simple console log for now)
                    if (car.isPlayer) {
                        console.log("Player got ITEM!");
                        // TODO: Update HUD
                        const hudItem = document.getElementById('item-val');
                        if (hudItem) hudItem.innerText = "Unknown"; // Randomize later
                    }

                    // Remove from array eventually
                }
            });
        });
    }

    destroy() {
        this.items.forEach(i => this.scene.remove(i));
        this.items = [];
    }
}
