import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
    constructor(graphics, audio) {
        this.camera = graphics.camera;
        this.camera.rotation.order = 'YXZ';
        this.domElement = graphics.renderer.domElement;
        this.audio = audio;
        
        this.controls = new PointerLockControls(this.camera, document.body);
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.speed = 25.0; // Fast movement like Quake/Turok
        this.canJump = false;
        
        this.camera.position.y = 2; // Eye height
        
        // Weapon Model (Simple Box for Gun)
        this.weapon = new THREE.Group();
        const gunGeo = new THREE.BoxGeometry(0.3, 0.3, 1);
        const gunMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const gunMesh = new THREE.Mesh(gunGeo, gunMat);
        gunMesh.position.set(0.5, -0.5, -1);
        this.weapon.add(gunMesh);
        this.camera.add(this.weapon);
        
        this.health = 100;
        this.ammo = 50;

        // Input state for mobile/keyboard unification
        this.moveState = { forward: 0, right: 0 };
        this.lookState = { x: 0, y: 0 };
    }

    jump() {
        if (this.canJump) {
            this.velocity.y = 15; // High jump
            this.canJump = false;
        }
    }

    shoot(scene, enemies) {
        if (this.ammo <= 0) return; // Click empty sound
        
        this.ammo--;
        document.getElementById('ammo-counter').innerText = this.ammo;
        
        // Audio
        this.audio.playShoot();
        
        // Recoil
        this.weapon.position.z += 0.2;
        
        // Muzzle Flash Light
        const light = new THREE.PointLight(0xffaa00, 5, 10);
        light.position.set(0.5, -0.3, -1.5);
        this.camera.add(light);
        setTimeout(() => this.camera.remove(light), 50);

        // Raycast
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0,0), this.camera);
        
        const intersects = raycaster.intersectObjects(enemies.map(e => e.mesh), true);
        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            // Find parent group (the enemy)
            let enemyGroup = hitObject;
            while(enemyGroup.parent && enemyGroup.parent.type !== 'Scene') {
                enemyGroup = enemyGroup.parent;
            }
            if (enemyGroup.userData.entity) {
                enemyGroup.userData.entity.takeDamage(10);
            }
        }
    }

    update(delta, world) {
        // Apply friction
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        
        // Gravity
        this.velocity.y -= 9.8 * 5.0 * delta; // Heavy gravity

        // Movement input vector
        this.direction.z = Number(this.moveState.forward) - Number(this.moveState.backward || 0);
        this.direction.x = Number(this.moveState.right) - Number(this.moveState.left || 0);
        this.direction.normalize(); // Ensure consistent speed in all directions

        if (this.moveState.forward || this.moveState.backward) this.velocity.z -= this.direction.z * this.speed * delta * 10;
        if (this.moveState.left || this.moveState.right) this.velocity.x -= this.direction.x * this.speed * delta * 10;

        // Apply Velocity
        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);
        
        this.camera.position.y += this.velocity.y * delta;

        // Terrain Collision
        const terrainH = world.getTerrainHeight(this.camera.position.x, this.camera.position.z);
        const playerHeight = 2.0;

        if (this.camera.position.y < terrainH + playerHeight) {
            this.velocity.y = 0;
            this.camera.position.y = terrainH + playerHeight;
            this.canJump = true;
        }

        // Weapon recovery
        if (this.weapon.position.z > -1) {
            this.weapon.position.z -= delta * 2;
        }
    }
}

export class Enemy {
    constructor(scene, textureLoader, position) {
        this.scene = scene;
        this.health = 30;
        this.active = true;
        
        const geo = new THREE.ConeGeometry(1, 2, 8);
        geo.rotateX(Math.PI / 2); // Point forward
        const tex = textureLoader.load('raptor_scale.png');
        const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffaaaa });
        
        this.mesh = new THREE.Group();
        
        const body = new THREE.Mesh(geo, mat);
        body.position.y = 1;
        this.mesh.add(body);
        
        this.mesh.position.copy(position);
        this.mesh.userData.entity = this;
        
        scene.add(this.mesh);
    }

    takeDamage(amount) {
        this.health -= amount;
        // Flash red
        this.mesh.children[0].material.color.setHex(0xff0000);
        setTimeout(() => {
            if(this.active) this.mesh.children[0].material.color.setHex(0xffaaaa);
        }, 100);

        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.active = false;
        this.scene.remove(this.mesh);
    }

    update(delta, playerPos, world) {
        if (!this.active) return;
        
        const dist = this.mesh.position.distanceTo(playerPos);
        
        // AI: Chase player
        if (dist < 30 && dist > 1.5) {
            this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);
            this.mesh.translateZ(8 * delta); // Move speed
            
            // Bobbing animation
            this.mesh.children[0].position.y = 1 + Math.sin(Date.now() * 0.01) * 0.2;
        }

        // Snap to terrain
        const terrainH = world.getTerrainHeight(this.mesh.position.x, this.mesh.position.z);
        this.mesh.position.y = terrainH;
    }
}