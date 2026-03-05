import * as THREE from 'three';

const MAPS = {
    1: { // Single functional map as requested
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
    2: { // The custom 23MB GLB track
        name: 'The Grand Prix',
        modelKey: 'track_glb',
        // Note: The physical mesh is loaded from the GLB. 
        // These points define an invisible "ghost track" for lap counting and AI steering.
        // We will need to tune this to match the actual GLB layout once we see it in the world!
        points: [
            new THREE.Vector3(0, 0, -100),
            new THREE.Vector3(100, 0, -100),
            new THREE.Vector3(200, 0, 0),
            new THREE.Vector3(100, 0, 100),
            new THREE.Vector3(0, 0, 100),
            new THREE.Vector3(-100, 0, 100),
            new THREE.Vector3(-200, 0, 0),
            new THREE.Vector3(-100, 0, -100),
        ]
    },
    3: {
        name: 'Race Track 2',
        modelKey: 'track_glb_2',
        points: [
            new THREE.Vector3(0, 0, -100),
            new THREE.Vector3(100, 0, -100),
            new THREE.Vector3(200, 0, 0),
            new THREE.Vector3(100, 0, 100),
            new THREE.Vector3(0, 0, 100),
            new THREE.Vector3(-100, 0, 100),
            new THREE.Vector3(-200, 0, 0),
            new THREE.Vector3(-100, 0, -100),
        ]
    }
};

export default MAPS;
