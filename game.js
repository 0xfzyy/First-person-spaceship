class SpaceGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.engine = new Engine3D(this.canvas);
        this.spaceship = new Spaceship(this.engine);
        this.particleSystem = new ParticleSystem();
        
        // Game objects
        this.stars = [];
        this.asteroids = [];
        this.obstacles = [];
        
        // Timing
        this.lastTime = 0;
        this.isRunning = false;
        
        // Environment
        this.ambientLight = vec3.fromValues(0.1, 0.1, 0.2);
        this.lightPosition = vec3.fromValues(100, 100, 100);
        this.lightColor = vec3.fromValues(1.0, 1.0, 0.9);
        
        this.init();
    }
    
    async init() {
        try {
            this.showLoadingScreen();
            
            // Create meshes
            this.createMeshes();
            
            // Generate environment
            this.generateStars(1000);
            this.generateAsteroids(50);
            
            await this.simulateLoading();
            this.hideLoadingScreen();
            
            this.start();
        } catch (error) {
            console.error('Failed to initialize game:', error);
        }
    }
    
    createMeshes() {
        // Create basic meshes for objects
        this.cubeMesh = createCube(this.engine, 1.0);
        this.sphereMesh = createSphere(this.engine, 1.0, 12);
        this.asteroidMesh = createSphere(this.engine, 1.0, 8); // Low-poly for asteroids
    }
    
    generateStars(count) {
        this.stars = [];
        for (let i = 0; i < count; i++) {
            const star = {
                position: vec3.fromValues(
                    (Math.random() - 0.5) * 2000,
                    (Math.random() - 0.5) * 2000,
                    (Math.random() - 0.5) * 2000
                ),
                size: Math.random() * 3 + 1,
                brightness: Math.random() * 0.8 + 0.2,
                color: this.getStarColor()
            };
            this.stars.push(star);
        }
    }
    
    getStarColor() {
        const colors = [
            [1.0, 1.0, 1.0, 1.0],      // White
            [0.8, 0.8, 1.0, 1.0],      // Blue-white
            [1.0, 0.9, 0.7, 1.0],      // Yellow
            [1.0, 0.7, 0.4, 1.0],      // Orange
            [1.0, 0.4, 0.4, 1.0]       // Red
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    generateAsteroids(count) {
        this.asteroids = [];
        for (let i = 0; i < count; i++) {
            const asteroid = {
                position: vec3.fromValues(
                    (Math.random() - 0.5) * 1000,
                    (Math.random() - 0.5) * 1000,
                    (Math.random() - 0.5) * 1000
                ),
                rotation: vec3.fromValues(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                ),
                angularVelocity: vec3.fromValues(
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5
                ),
                scale: Math.random() * 5 + 2,
                color: vec3.fromValues(
                    0.4 + Math.random() * 0.3,
                    0.3 + Math.random() * 0.3,
                    0.2 + Math.random() * 0.3
                )
            };
            
            // Make sure asteroids don't spawn too close to origin
            const distance = vec3.length(asteroid.position);
            if (distance < 50) {
                vec3.normalize(asteroid.position, asteroid.position);
                vec3.scale(asteroid.position, asteroid.position, 50 + Math.random() * 50);
            }
            
            this.asteroids.push(asteroid);
        }
    }
    
    async simulateLoading() {
        return new Promise(resolve => {
            setTimeout(resolve, 3000);
        });
    }
    
    showLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'flex';
        document.getElementById('game-container').style.display = 'none';
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.classList.add('hidden');
        document.getElementById('game-container').style.display = 'block';
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 1000);
    }
    
    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }
    
    stop() {
        this.isRunning = false;
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        this.update(deltaTime);
        this.render();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    update(deltaTime) {
        // Update spaceship
        this.spaceship.update(deltaTime);
        
        // Update particle systems
        this.particleSystem.update(deltaTime);
        
        // Update asteroids
        this.updateAsteroids(deltaTime);
        
        // Generate new objects if player moves far
        this.updateEnvironment();
        
        // Check collisions
        this.checkCollisions();
    }
    
    updateAsteroids(deltaTime) {
        this.asteroids.forEach(asteroid => {
            // Rotate asteroids
            vec3.scaleAndAdd(asteroid.rotation, asteroid.rotation, asteroid.angularVelocity, deltaTime);
        });
    }
    
    updateEnvironment() {
        const playerPos = this.spaceship.position;
        
        // Remove distant objects and add new ones
        this.cullDistantObjects(playerPos, 500);
        
        // Add new objects around the player
        this.generateNearbyObjects(playerPos);
    }
    
    cullDistantObjects(playerPos, maxDistance) {
        // Remove distant stars
        this.stars = this.stars.filter(star => {
            const distance = vec3.distance(star.position, playerPos);
            return distance < maxDistance;
        });
        
        // Remove distant asteroids
        this.asteroids = this.asteroids.filter(asteroid => {
            const distance = vec3.distance(asteroid.position, playerPos);
            return distance < maxDistance;
        });
    }
    
    generateNearbyObjects(playerPos) {
        // Add stars if we don't have enough
        while (this.stars.length < 500) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 100 + Math.random() * 400;
            const star = {
                position: vec3.fromValues(
                    playerPos[0] + Math.cos(angle) * distance,
                    playerPos[1] + (Math.random() - 0.5) * 200,
                    playerPos[2] + Math.sin(angle) * distance
                ),
                size: Math.random() * 3 + 1,
                brightness: Math.random() * 0.8 + 0.2,
                color: this.getStarColor()
            };
            this.stars.push(star);
        }
        
        // Add asteroids if we don't have enough
        while (this.asteroids.length < 30) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 300;
            const asteroid = {
                position: vec3.fromValues(
                    playerPos[0] + Math.cos(angle) * distance,
                    playerPos[1] + (Math.random() - 0.5) * 100,
                    playerPos[2] + Math.sin(angle) * distance
                ),
                rotation: vec3.fromValues(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                ),
                angularVelocity: vec3.fromValues(
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5,
                    (Math.random() - 0.5) * 0.5
                ),
                scale: Math.random() * 5 + 2,
                color: vec3.fromValues(
                    0.4 + Math.random() * 0.3,
                    0.3 + Math.random() * 0.3,
                    0.2 + Math.random() * 0.3
                )
            };
            this.asteroids.push(asteroid);
        }
    }
    
    checkCollisions() {
        const shipPos = this.spaceship.position;
        const shipRadius = 2.0;
        
        // Check asteroid collisions
        this.asteroids.forEach(asteroid => {
            const distance = vec3.distance(shipPos, asteroid.position);
            if (distance < shipRadius + asteroid.scale) {
                this.handleCollision(asteroid);
            }
        });
    }
    
    handleCollision(asteroid) {
        // Damage the ship
        this.spaceship.health -= 10;
        
        // Create explosion effect
        this.particleSystem.createExplosion(
            vec3.clone(asteroid.position),
            [1.0, 0.5, 0.0, 1.0],
            30
        );
        
        // Remove the asteroid
        const index = this.asteroids.indexOf(asteroid);
        if (index > -1) {
            this.asteroids.splice(index, 1);
        }
        
        // Check game over
        if (this.spaceship.health <= 0) {
            this.gameOver();
        }
    }
    
    gameOver() {
        console.log('Game Over!');
        // Could add game over screen here
    }
    
    render() {
        this.engine.clear();
        
        // Render stars
        this.renderStars();
        
        // Render asteroids
        this.renderAsteroids();
        
        // Render particles
        this.renderParticles();
    }
    
    renderStars() {
        const starParticles = this.stars.map(star => ({
            position: star.position,
            size: star.size,
            color: [
                star.color[0] * star.brightness,
                star.color[1] * star.brightness,
                star.color[2] * star.brightness,
                star.color[3]
            ]
        }));
        
        if (starParticles.length > 0) {
            this.engine.drawParticles(starParticles);
        }
    }
    
    renderAsteroids() {
        this.asteroids.forEach(asteroid => {
            const modelMatrix = mat4.create();
            mat4.translate(modelMatrix, modelMatrix, asteroid.position);
            mat4.rotateX(modelMatrix, modelMatrix, asteroid.rotation[0]);
            mat4.rotateY(modelMatrix, modelMatrix, asteroid.rotation[1]);
            mat4.rotateZ(modelMatrix, modelMatrix, asteroid.rotation[2]);
            mat4.scale(modelMatrix, modelMatrix, [asteroid.scale, asteroid.scale, asteroid.scale]);
            
            const normalMatrix = mat3.create();
            mat3.normalFromMat4(normalMatrix, modelMatrix);
            
            const uniforms = {
                uModelMatrix: modelMatrix,
                uViewMatrix: this.engine.viewMatrix,
                uProjectionMatrix: this.engine.projectionMatrix,
                uNormalMatrix: normalMatrix,
                uLightPosition: this.lightPosition,
                uLightColor: this.lightColor,
                uAmbientColor: this.ambientLight,
                uDiffuseColor: asteroid.color,
                uSpecularColor: vec3.fromValues(0.2, 0.2, 0.2),
                uShininess: 32.0,
                uCameraPosition: this.spaceship.camera.position
            };
            
            this.engine.drawMesh(this.asteroidMesh, uniforms);
        });
    }
    
    renderParticles() {
        // Combine all particle systems
        const allParticles = [
            ...this.spaceship.getParticles(),
            ...this.particleSystem.getParticles()
        ];
        
        if (allParticles.length > 0) {
            this.engine.drawParticles(allParticles);
        }
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    const game = new SpaceGame();
    
    // Make game accessible for debugging
    window.game = game;
}); 