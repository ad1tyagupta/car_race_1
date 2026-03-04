import * as THREE from 'three';
import Game from './Game.js';
import AssetLoader from './AssetLoader.js';
import MAPS from './maps.js';

// ── Three.js scene setup ─────────────────────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 250, 700);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1500);
camera.position.set(0, 50, 80);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-container').appendChild(renderer.domElement);

// ── Lighting ─────────────────────────────────────────────────────────────────

// Ambient — fills shadow areas
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

// Main directional sun
const sun = new THREE.DirectionalLight(0xfffce0, 1.8);
sun.position.set(100, 200, 80);
sun.castShadow = true;
sun.shadow.mapSize.width = 4096;
sun.shadow.mapSize.height = 4096;
sun.shadow.camera.top = 250;
sun.shadow.camera.bottom = -250;
sun.shadow.camera.left = -250;
sun.shadow.camera.right = 250;
sun.shadow.bias = -0.0003;
scene.add(sun);

// Sky hemisphere (sky blue top, green-ish ground)
const hemi = new THREE.HemisphereLight(0x87ceeb, 0x2d5a1b, 0.7);
scene.add(hemi);

// ── Game objects ─────────────────────────────────────────────────────────────

const assetLoader = new AssetLoader();
const game = new Game(scene, camera, renderer, assetLoader);

// ── UI bindings ───────────────────────────────────────────────────────────────

const ui = {
    loading: document.getElementById('loading-screen'),
    mainMenu: document.getElementById('main-menu'),
    trackSelect: document.getElementById('track-select'),
    hud: document.getElementById('hud'),
    gameOver: document.getElementById('game-over'),
    restartBtn: document.getElementById('restart-btn'),
};

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    try {
        await assetLoader.loadAll();

        ui.loading.style.display = 'none';
        ui.mainMenu.classList.remove('hidden');

        // Build track buttons from MAPS
        ui.trackSelect.innerHTML = '';
        Object.entries(MAPS).forEach(([id, mapDef]) => {
            const btn = document.createElement('div');
            btn.className = 'track-btn';
            btn.innerText = mapDef.name;
            btn.onclick = () => startGame(Number(id));
            ui.trackSelect.appendChild(btn);
        });

        ui.restartBtn.onclick = () => {
            ui.gameOver.classList.add('hidden');
            ui.mainMenu.classList.remove('hidden');
            game.reset();
        };

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        animate();

    } catch (err) {
        console.error('[main] Init failed:', err);
        ui.loading.innerText = 'ERROR — Check Console (F12)';
    }
}

function startGame(mapId) {
    try {
        ui.mainMenu.classList.add('hidden');
        ui.hud.classList.remove('hidden');
        game.start(mapId);
    } catch (err) {
        console.error('[main] startGame failed:', err);
        ui.mainMenu.classList.remove('hidden');
        ui.hud.classList.add('hidden');
        alert('Failed to start. Check console (F12).');
    }
}

// ── Render loop ───────────────────────────────────────────────────────────────

function animate() {
    requestAnimationFrame(animate);
    try {
        if (game.state === 'PLAY' || game.state === 'GAMEOVER') {
            game.update();
        }
        renderer.render(scene, camera);
    } catch (err) {
        console.error('[main] Runtime error:', err);
        game.state = 'ERROR';
    }
}

init();
