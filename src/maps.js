import * as THREE from 'three';

/**
 * MAPS — Track waypoint definitions.
 * Each map is an array of THREE.Vector3 control points on the XZ plane (Y=0).
 * These define the spine of a CatmullRomCurve3 closed loop.
 * Scale is in world units (1 unit ≈ 1 meter). Tracks are ~80-150 units across.
 */
const MAPS = {
    1: { // The Circuit — smooth oval
        name: 'The Circuit',
        points: [
            new THREE.Vector3(80, 0, 0),
            new THREE.Vector3(60, 0, 60),
            new THREE.Vector3(0, 0, 90),
            new THREE.Vector3(-60, 0, 60),
            new THREE.Vector3(-80, 0, 0),
            new THREE.Vector3(-60, 0, -60),
            new THREE.Vector3(0, 0, -90),
            new THREE.Vector3(60, 0, -60),
        ],
    },
    2: { // The City — figure-8 style with tighter corners
        name: 'The City',
        points: [
            new THREE.Vector3(80, 0, 0),
            new THREE.Vector3(40, 0, 70),
            new THREE.Vector3(-40, 0, 30),
            new THREE.Vector3(-80, 0, 0),
            new THREE.Vector3(-40, 0, -30),
            new THREE.Vector3(40, 0, -70),
        ],
    },
    3: { // The Void — tight technical track
        name: 'The Void',
        points: [
            new THREE.Vector3(60, 0, 10),
            new THREE.Vector3(30, 0, 50),
            new THREE.Vector3(0, 0, 60),
            new THREE.Vector3(-30, 0, 40),
            new THREE.Vector3(-55, 0, 0),
            new THREE.Vector3(-30, 0, -40),
            new THREE.Vector3(0, 0, -60),
            new THREE.Vector3(30, 0, -40),
            new THREE.Vector3(55, 0, -10),
        ],
    },
};

export default MAPS;
