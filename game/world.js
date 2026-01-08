import * as THREE from 'three';

export class World {
    constructor(graphics, textureLoader) {
        this.scene = graphics.scene;
        this.textureLoader = textureLoader;
        this.colliders = [];
    }

    getTerrainHeight(x, z) {
        return Math.sin(x * 0.05) * 2 + Math.cos(z * 0.05) * 2;
    }

    buildJungle() {
        // Textures
        const grassTex = this.textureLoader.load('grass_moss.png');
        grassTex.wrapS = THREE.RepeatWrapping;
        grassTex.wrapT = THREE.RepeatWrapping;
        grassTex.repeat.set(64, 64);
        grassTex.magFilter = THREE.NearestFilter;
        grassTex.minFilter = THREE.NearestFilter;

        const stoneTex = this.textureLoader.load('ancient_stone.png');
        stoneTex.magFilter = THREE.NearestFilter;

        // Ground
        const groundGeo = new THREE.PlaneGeometry(500, 500, 100, 100);
        
        // Simple terrain displacement
        const posAttribute = groundGeo.attributes.position;
        for (let i = 0; i < posAttribute.count; i++) {
            const x = posAttribute.getX(i);
            const y = posAttribute.getY(i);
            // World Z is -y due to rotation
            const h = this.getTerrainHeight(x, -y);
            posAttribute.setZ(i, h);
        }
        groundGeo.computeVertexNormals();
        
        const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.colliders.push(ground);

        // Trees
        const treeGeo = new THREE.CylinderGeometry(1, 2, 15, 6);
        const treeMat = new THREE.MeshLambertMaterial({ color: 0x3d2817 });
        const leavesGeo = new THREE.ConeGeometry(5, 10, 6);
        const leavesMat = new THREE.MeshLambertMaterial({ color: 0x1e4f1e });

        for (let i = 0; i < 50; i++) {
            const x = (Math.random() - 0.5) * 200;
            const z = (Math.random() - 0.5) * 200;
            
            // Don't spawn near center
            if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;

            const tree = new THREE.Mesh(treeGeo, treeMat);
            tree.position.set(x, 7.5, z);
            tree.castShadow = true;
            this.scene.add(tree);
            this.colliders.push(tree);

            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.set(0, 10, 0);
            tree.add(leaves);
        }

        // Ancient Ruins (The Portal Area)
        const archGeo = new THREE.TorusGeometry(8, 1, 16, 32);
        const archMat = new THREE.MeshPhongMaterial({ map: stoneTex, shininess: 50 });
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.set(0, 8, -40);
        arch.castShadow = true;
        this.scene.add(arch);

        // Portal Effect
        const portalGeo = new THREE.CircleGeometry(7, 32);
        const portalMat = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(0x00ffcc) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color;
                varying vec2 vUv;
                
                // Simplex noise function would go here, using simple sine placeholder
                void main() {
                    vec2 center = vec2(0.5, 0.5);
                    float dist = distance(vUv, center);
                    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
                    
                    float pattern = sin(dist * 20.0 - time * 5.0) + sin(angle * 10.0 + time * 2.0);
                    float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
                    
                    gl_FragColor = vec4(color * (pattern * 0.5 + 0.5), alpha * 0.8);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        this.portalMesh = new THREE.Mesh(portalGeo, portalMat);
        this.portalMesh.position.set(0, 8, -40);
        this.scene.add(this.portalMesh);
    }
    
    update(time) {
        if(this.portalMesh) {
            this.portalMesh.material.uniforms.time.value = time;
        }
    }
}