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
    }
};

export default MAPS;
