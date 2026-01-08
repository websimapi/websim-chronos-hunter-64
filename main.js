import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { GraphicsEngine } from './engine/graphics.js';
import { AudioSystem } from './engine/audio.js';
import { World } from './game/world.js';
import { Player, Enemy } from './game/entities.js';

// Setup Loading Screen Animation
const loadCanvas = document.getElementById('loading-canvas');
const loadCtx = loadCanvas.getContext('2d');
let loadProgress = 0;
let assetsLoaded = false;

function resizeLoadCanvas() {
    loadCanvas.width = window.innerWidth;
    loadCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeLoadCanvas);
resizeLoadCanvas();

function drawLoading(time) {
    if (assetsLoaded && loadProgress >= 100) return;
    
    // Shader-like effect on 2D canvas
    loadCtx.fillStyle = '#000000';
    loadCtx.fillRect(0, 0, loadCanvas.width, loadCanvas.height);
    
    const centerX = loadCanvas.width / 2;
    const centerY = loadCanvas.height / 2;
    
    for (let i = 0; i < 50; i++) {
        const radius = (i * 10 + time * 0.1) % (Math.max(centerX, centerY));
        const alpha = 1 - (radius / Math.max(centerX, centerY));
        loadCtx.beginPath();
        loadCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        loadCtx.strokeStyle = `rgba(0, 255, 204, ${alpha * 0.5})`;
        loadCtx.lineWidth = 2;
        loadCtx.stroke();
    }
    
    loadProgress += 0.5; // Simulate loading
    document.getElementById('loading-progress').style.width = Math.min(loadProgress, 100) + '%';
    
    if (loadProgress < 100) {
        requestAnimationFrame(() => drawLoading(Date.now()));
    } else {
        showMainMenu();
    }
}
drawLoading(Date.now());

// Game State
let isGameRunning = false;
let engine, audio, world, player;
const enemies = [];
const textureLoader = new THREE.TextureLoader();

function showMainMenu() {
    document.getElementById('loading-screen').style.display = 'none';
    const menu = document.getElementById('main-menu');
    menu.style.display = 'flex';
    
    // Init Engine in background for menu background
    engine = new GraphicsEngine('game-container');
    world = new World(engine, textureLoader);
    world.buildJungle();
    
    // Start Menu Loop
    animateMenu();
}

function animateMenu() {
    if (isGameRunning) return;
    requestAnimationFrame(animateMenu);
    
    // Rotate camera around portal
    const time = Date.now() * 0.0005;
    engine.camera.position.x = Math.sin(time) * 30;
    engine.camera.position.z = Math.cos(time) * 30 - 40; // Center on portal
    engine.camera.position.y = 15;
    engine.camera.lookAt(0, 8, -40);
    
    world.update(time);
    engine.render();
}

// Start Game Logic
document.getElementById('btn-start').addEventListener('click', async () => {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('ui-layer').style.pointerEvents = 'none'; // Pass through to canvas mostly
    document.getElementById('hud').style.display = 'block';
    
    audio = new AudioSystem();
    await audio.init();
    audio.loadSound('shoot', 'assets/shoot.mp3'); // We'll use procedural fallback if fails
    audio.playMusic('jungle_ambience.mp3', 0.5);

    player = new Player(engine, audio);
    
    // Spawn Enemies
    for(let i=0; i<5; i++) {
        enemies.push(new Enemy(engine.scene, textureLoader, new THREE.Vector3(
            (Math.random()-0.5)*100, 
            0, 
            (Math.random()-0.5)*100 - 40
        )));
    }

    isGameRunning = true;
    
    setupControls();
    gameLoop();
});

function setupControls() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        document.getElementById('mobile-controls').style.display = 'block';
        
        // Move Joystick
        const managerL = nipplejs.create({
            zone: document.getElementById('zone-left'),
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });
        
        managerL.on('move', (evt, data) => {
            const forward = Math.sin(data.angle.radian);
            const right = Math.cos(data.angle.radian);
            // Simple mapping
            player.moveState.forward = forward > 0.3 ? 1 : (forward < -0.3 ? -1 : 0); // Not ideal mapping for WASD logic but works for float
            player.moveState.backward = 0; // Handled by negative forward logic in simple implementation
            // Actually, let's map directly to velocity modifiers in player update
            
            // Re-map for simple WASD emulation:
            player.moveState.forward = data.vector.y; 
            player.moveState.right = data.vector.x; 
            player.moveState.backward = 0;
            player.moveState.left = 0;
        });
        
        managerL.on('end', () => {
            player.moveState.forward = 0;
            player.moveState.right = 0;
        });

        // Look Joystick
        const managerR = nipplejs.create({
            zone: document.getElementById('zone-right'),
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });
        
        managerR.on('move', (evt, data) => {
             // Rotate player view
             player.camera.rotation.y -= data.vector.x * 0.05;
             // Vertical look (clamped)
             player.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, player.camera.rotation.x - data.vector.y * 0.05));
        });

        // Buttons
        document.getElementById('btn-jump').addEventListener('touchstart', (e) => { e.preventDefault(); player.jump(); });
        document.getElementById('btn-fire').addEventListener('touchstart', (e) => { e.preventDefault(); player.shoot(engine.scene, enemies); });

    } else {
        // Desktop Controls
        document.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'KeyW': player.moveState.forward = 1; break;
                case 'KeyS': player.moveState.backward = 1; break;
                case 'KeyA': player.moveState.left = 1; break;
                case 'KeyD': player.moveState.right = 1; break;
                case 'Space': player.jump(); break;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            switch(e.code) {
                case 'KeyW': player.moveState.forward = 0; break;
                case 'KeyS': player.moveState.backward = 0; break;
                case 'KeyA': player.moveState.left = 0; break;
                case 'KeyD': player.moveState.right = 0; break;
            }
        });

        document.addEventListener('click', () => {
            if (!player.controls.isLocked) {
                player.controls.lock();
                audio.init(); // Ensure audio context is resumed on click
            } else {
                player.shoot(engine.scene, enemies);
            }
        });
    }
}

function gameLoop() {
    if (!isGameRunning) return;
    requestAnimationFrame(gameLoop);

    const delta = engine.clock.getDelta();
    const time = Date.now() * 0.001;

    player.update(delta, world.colliders);
    world.update(time);

    // Update Enemies
    enemies.forEach(enemy => enemy.update(delta, player.camera.position));

    engine.render();
}