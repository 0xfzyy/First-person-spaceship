class Spaceship {
    constructor(engine) {
        this.engine = engine;
        
        // Position and orientation
        this.position = vec3.fromValues(0, 0, 0);
        this.velocity = vec3.fromValues(0, 0, 0);
        this.acceleration = vec3.fromValues(0, 0, 0);
        
        // Rotation (pitch, yaw, roll)
        this.rotation = vec3.fromValues(0, 0, 0);
        this.angularVelocity = vec3.fromValues(0, 0, 0);
        
        // Physics properties
        this.mass = 1.0;
        this.maxSpeed = 50.0;
        this.thrustPower = 30.0;
        this.brakePower = 20.0;
        this.boostMultiplier = 2.0;
        this.maneuverability = 2.0;
        this.drag = 0.95;
        this.angularDrag = 0.9;
        
        // State
        this.health = 100;
        this.speed = 0;
        this.isBoosting = false;
        this.isBraking = false;
        
        // Controls
        this.input = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false,
            boost: false,
            brake: false,
            mouseX: 0,
            mouseY: 0
        };
        
        // Camera
        this.camera = {
            position: vec3.create(),
            forward: vec3.fromValues(0, 0, -1),
            up: vec3.fromValues(0, 1, 0),
            right: vec3.fromValues(1, 0, 0)
        };
        
        // Particles
        this.engineParticles = [];
        this.exhaustParticles = [];
        
        // Mouse sensitivity
        this.mouseSensitivity = 0.002;
        
        this.setupControls();
        this.updateCamera();
    }
    
    setupControls() {
        // Keyboard controls
        const keys = {};
        
        window.addEventListener('keydown', (e) => {
            keys[e.code] = true;
            this.updateInputFromKeys(keys);
        });
        
        window.addEventListener('keyup', (e) => {
            keys[e.code] = false;
            this.updateInputFromKeys(keys);
        });
        
        // Mouse controls
        let isMouseLocked = false;
        
        this.engine.canvas.addEventListener('click', () => {
            if (!isMouseLocked) {
                this.engine.canvas.requestPointerLock();
            }
        });
        
        document.addEventListener('pointerlockchange', () => {
            isMouseLocked = document.pointerLockElement === this.engine.canvas;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isMouseLocked) {
                this.input.mouseX = e.movementX * this.mouseSensitivity;
                this.input.mouseY = e.movementY * this.mouseSensitivity;
            }
        });
    }
    
    updateInputFromKeys(keys) {
        this.input.forward = keys['KeyW'] || false;
        this.input.backward = keys['KeyS'] || false;
        this.input.left = keys['KeyA'] || false;
        this.input.right = keys['KeyD'] || false;
        this.input.up = keys['KeyR'] || false;
        this.input.down = keys['KeyF'] || false;
        this.input.boost = keys['Space'] || false;
        this.input.brake = keys['ShiftLeft'] || keys['ShiftRight'] || false;
    }
    
    update(deltaTime) {
        this.handleInput(deltaTime);
        this.updatePhysics(deltaTime);
        this.updateCamera();
        this.updateParticles(deltaTime);
        this.updateHUD();
        
        // Reset mouse input
        this.input.mouseX = 0;
        this.input.mouseY = 0;
    }
    
    handleInput(deltaTime) {
        // Mouse look
        this.rotation[1] -= this.input.mouseX; // Yaw
        this.rotation[0] -= this.input.mouseY; // Pitch
        
        // Clamp pitch
        this.rotation[0] = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.rotation[0]));
        
        // Movement input
        const thrust = vec3.create();
        
        if (this.input.forward) thrust[2] -= 1;
        if (this.input.backward) thrust[2] += 1;
        if (this.input.left) thrust[0] -= 1;
        if (this.input.right) thrust[0] += 1;
        if (this.input.up) thrust[1] += 1;
        if (this.input.down) thrust[1] -= 1;
        
        // Normalize thrust vector
        if (vec3.length(thrust) > 0) {
            vec3.normalize(thrust, thrust);
        }
        
        // Apply thrust in local space
        const localThrust = vec3.create();
        vec3.copy(localThrust, thrust);
        
        // Transform to world space
        const rotationMatrix = mat4.create();
        mat4.fromRotation(rotationMatrix, this.rotation[1], [0, 1, 0]); // Yaw
        mat4.rotateX(rotationMatrix, rotationMatrix, this.rotation[0]); // Pitch
        mat4.rotateZ(rotationMatrix, rotationMatrix, this.rotation[2]); // Roll
        
        const worldThrust = vec3.create();
        vec3.transformMat4(worldThrust, localThrust, rotationMatrix);
        
        // Apply thrust force
        let thrustMultiplier = this.thrustPower;
        
        this.isBoosting = this.input.boost;
        this.isBraking = this.input.brake;
        
        if (this.isBoosting) {
            thrustMultiplier *= this.boostMultiplier;
        }
        
        vec3.scaleAndAdd(this.acceleration, this.acceleration, worldThrust, thrustMultiplier / this.mass);
        
        // Braking
        if (this.isBraking) {
            const brakeForce = vec3.create();
            vec3.normalize(brakeForce, this.velocity);
            vec3.scale(brakeForce, brakeForce, -this.brakePower / this.mass);
            vec3.add(this.acceleration, this.acceleration, brakeForce);
        }
        
        // Create engine particles when thrusting
        if (vec3.length(thrust) > 0 || this.isBoosting) {
            this.createEngineParticles();
        }
    }
    
    updatePhysics(deltaTime) {
        // Update velocity
        vec3.scaleAndAdd(this.velocity, this.velocity, this.acceleration, deltaTime);
        
        // Apply drag
        vec3.scale(this.velocity, this.velocity, this.drag);
        
        // Limit max speed
        const currentSpeed = vec3.length(this.velocity);
        if (currentSpeed > this.maxSpeed) {
            vec3.scale(this.velocity, this.velocity, this.maxSpeed / currentSpeed);
        }
        
        // Update position
        vec3.scaleAndAdd(this.position, this.position, this.velocity, deltaTime);
        
        // Update angular velocity with drag
        vec3.scale(this.angularVelocity, this.angularVelocity, this.angularDrag);
        
        // Update rotation
        vec3.scaleAndAdd(this.rotation, this.rotation, this.angularVelocity, deltaTime);
        
        // Clear acceleration
        vec3.set(this.acceleration, 0, 0, 0);
        
        // Update speed for HUD
        this.speed = vec3.length(this.velocity);
    }
    
    updateCamera() {
        // Calculate camera orientation vectors
        const pitch = this.rotation[0];
        const yaw = this.rotation[1];
        const roll = this.rotation[2];
        
        // Forward vector
        this.camera.forward[0] = Math.cos(pitch) * Math.sin(yaw);
        this.camera.forward[1] = -Math.sin(pitch);
        this.camera.forward[2] = -Math.cos(pitch) * Math.cos(yaw);
        
        // Right vector
        vec3.cross(this.camera.right, this.camera.forward, [0, 1, 0]);
        vec3.normalize(this.camera.right, this.camera.right);
        
        // Up vector (with roll)
        vec3.cross(this.camera.up, this.camera.right, this.camera.forward);
        
        // Apply roll
        const rollMatrix = mat4.create();
        mat4.fromRotation(rollMatrix, roll, this.camera.forward);
        vec3.transformMat4(this.camera.up, this.camera.up, rollMatrix);
        vec3.transformMat4(this.camera.right, this.camera.right, rollMatrix);
        
        // Position camera inside cockpit
        vec3.copy(this.camera.position, this.position);
        
        // Update engine view matrix
        const target = vec3.create();
        vec3.add(target, this.camera.position, this.camera.forward);
        mat4.lookAt(this.engine.viewMatrix, this.camera.position, target, this.camera.up);
    }
    
    createEngineParticles() {
        // Create exhaust particles behind the ship
        const exhaustPosition = vec3.create();
        vec3.copy(exhaustPosition, this.position);
        
        // Move particles behind the ship
        const backDirection = vec3.create();
        vec3.negate(backDirection, this.camera.forward);
        vec3.scaleAndAdd(exhaustPosition, exhaustPosition, backDirection, 2.0);
        
        // Add some randomness
        exhaustPosition[0] += (Math.random() - 0.5) * 0.5;
        exhaustPosition[1] += (Math.random() - 0.5) * 0.5;
        exhaustPosition[2] += (Math.random() - 0.5) * 0.5;
        
        const particle = {
            position: exhaustPosition,
            velocity: vec3.create(),
            color: this.isBoosting ? 
                [0.0, 0.7, 1.0, 1.0] : 
                [0.0, 0.4, 1.0, 0.8],
            size: Math.random() * 8 + 4,
            life: 0.5 + Math.random() * 0.5,
            maxLife: 0.5 + Math.random() * 0.5
        };
        
        // Set particle velocity away from ship
        vec3.scaleAndAdd(particle.velocity, particle.velocity, backDirection, 20 + Math.random() * 10);
        
        this.engineParticles.push(particle);
    }
    
    updateParticles(deltaTime) {
        // Update engine particles
        for (let i = this.engineParticles.length - 1; i >= 0; i--) {
            const particle = this.engineParticles[i];
            
            // Update position
            vec3.scaleAndAdd(particle.position, particle.position, particle.velocity, deltaTime);
            
            // Update life
            particle.life -= deltaTime;
            
            // Fade out
            particle.color[3] = particle.life / particle.maxLife;
            particle.size *= 0.98;
            
            // Remove dead particles
            if (particle.life <= 0 || particle.size < 0.1) {
                this.engineParticles.splice(i, 1);
            }
        }
        
        // Limit particle count
        if (this.engineParticles.length > 100) {
            this.engineParticles.splice(0, this.engineParticles.length - 100);
        }
    }
    
    updateHUD() {
        // Update speed meter
        const speedPercent = Math.min(this.speed / this.maxSpeed * 100, 100);
        document.getElementById('speed-fill').style.width = speedPercent + '%';
        document.getElementById('speed-value').textContent = Math.round(this.speed);
        
        // Update health meter
        document.getElementById('health-fill').style.width = this.health + '%';
        document.getElementById('health-value').textContent = Math.round(this.health);
        
        // Update coordinates
        document.getElementById('coord-x').textContent = `X: ${Math.round(this.position[0])}`;
        document.getElementById('coord-y').textContent = `Y: ${Math.round(this.position[1])}`;
        document.getElementById('coord-z').textContent = `Z: ${Math.round(this.position[2])}`;
    }
    
    getParticles() {
        return this.engineParticles;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }
    
    createExplosion(position, color = [1.0, 0.5, 0.0, 1.0], count = 50) {
        for (let i = 0; i < count; i++) {
            const particle = {
                position: vec3.clone(position),
                velocity: vec3.fromValues(
                    (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 40
                ),
                color: [...color],
                size: Math.random() * 6 + 2,
                life: 1.0 + Math.random() * 2.0,
                maxLife: 1.0 + Math.random() * 2.0
            };
            
            this.particles.push(particle);
        }
    }
    
    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Update position
            vec3.scaleAndAdd(particle.position, particle.position, particle.velocity, deltaTime);
            
            // Apply gravity/drag
            vec3.scale(particle.velocity, particle.velocity, 0.98);
            
            // Update life
            particle.life -= deltaTime;
            
            // Fade out
            particle.color[3] = particle.life / particle.maxLife;
            particle.size *= 0.99;
            
            // Remove dead particles
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    getParticles() {
        return this.particles;
    }
} 