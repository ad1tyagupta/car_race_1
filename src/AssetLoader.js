import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * AssetLoader — loads GLTF/GLB models with timeout safety.
 * All models are stored in an internal Map and accessible via get(key).
 */
export default class AssetLoader {
    constructor() {
        this._loader = new GLTFLoader();
        this._models = new Map();

        // List of assets to load. Models that don't exist will resolve to null (graceful).
        this._queue = [
            { key: 'car1', url: 'assets/models/Car_1.glb' },
            { key: 'car2', url: 'assets/models/Car_2.glb' },
            { key: 'car3', url: 'assets/models/Car_3.glb' },
            { key: 'track_glb', url: 'assets/race_track/race-track-23mb-glb/source/track.glb' },
            { key: 'track_glb_2', url: 'assets/race_track/Race_Track_2.glb' }
        ];
    }

    /** Load all queued assets. Returns when all settle (never rejects). */
    async loadAll() {
        const promises = this._queue.map(({ key, url }) => this._loadOne(key, url));
        await Promise.all(promises);
        console.log('[AssetLoader] Done. Loaded:', [...this._models.keys()]);
    }

    _loadOne(key, url) {
        return new Promise((resolve) => {
            // 15-second timeout — if model fails/hangs we continue with null (large tracks)
            const timer = setTimeout(() => {
                console.warn(`[AssetLoader] Timeout: ${key}`);
                resolve(null);
            }, 15000);

            this._loader.load(
                url,
                (gltf) => {
                    clearTimeout(timer);
                    const scene = gltf.scene;
                    scene.traverse(c => {
                        if (c.isMesh) {
                            c.castShadow = true;
                            c.receiveShadow = true;
                        }
                    });
                    this._models.set(key, scene);
                    console.log(`[AssetLoader] Loaded: ${key}`);
                    resolve(scene);
                },
                undefined,
                (err) => {
                    clearTimeout(timer);
                    console.warn(`[AssetLoader] Failed: ${url}`, err.message ?? err);
                    resolve(null); // non-fatal — car will use procedural mesh
                }
            );
        });
    }

    /** @returns {THREE.Object3D|null} */
    get(key) {
        return this._models.get(key) ?? null;
    }
}
