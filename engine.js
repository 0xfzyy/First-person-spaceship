class Engine3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
        
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        
        this.shaderProgram = this.createShaderProgram();
        this.particleProgram = this.createParticleShaderProgram();
        
        this.viewMatrix = mat4.create();
        this.projectionMatrix = mat4.create();
        this.modelMatrix = mat4.create();
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        mat4.perspective(this.projectionMatrix, 
            Math.PI / 4, 
            this.canvas.width / this.canvas.height, 
            0.1, 
            1000.0
        );
    }
    
    createShaderProgram() {
        const vertexShaderSource = `
            attribute vec3 aPosition;
            attribute vec3 aNormal;
            attribute vec2 aTexCoord;
            
            uniform mat4 uModelMatrix;
            uniform mat4 uViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform mat3 uNormalMatrix;
            
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vTexCoord;
            
            void main() {
                vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
                vPosition = worldPosition.xyz;
                vNormal = normalize(uNormalMatrix * aNormal);
                vTexCoord = aTexCoord;
                
                gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
            }
        `;
        
        const fragmentShaderSource = `
            precision mediump float;
            
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vTexCoord;
            
            uniform vec3 uLightPosition;
            uniform vec3 uLightColor;
            uniform vec3 uAmbientColor;
            uniform vec3 uDiffuseColor;
            uniform vec3 uSpecularColor;
            uniform float uShininess;
            uniform vec3 uCameraPosition;
            
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 lightDir = normalize(uLightPosition - vPosition);
                vec3 viewDir = normalize(uCameraPosition - vPosition);
                vec3 reflectDir = reflect(-lightDir, normal);
                
                // Ambient
                vec3 ambient = uAmbientColor * uDiffuseColor;
                
                // Diffuse
                float diff = max(dot(normal, lightDir), 0.0);
                vec3 diffuse = diff * uLightColor * uDiffuseColor;
                
                // Specular
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
                vec3 specular = spec * uLightColor * uSpecularColor;
                
                vec3 result = ambient + diffuse + specular;
                gl_FragColor = vec4(result, 1.0);
            }
        `;
        
        return this.createProgram(vertexShaderSource, fragmentShaderSource);
    }
    
    createParticleShaderProgram() {
        const vertexShaderSource = `
            attribute vec3 aPosition;
            attribute float aSize;
            attribute vec4 aColor;
            
            uniform mat4 uViewMatrix;
            uniform mat4 uProjectionMatrix;
            
            varying vec4 vColor;
            
            void main() {
                vColor = aColor;
                gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
                gl_PointSize = aSize;
            }
        `;
        
        const fragmentShaderSource = `
            precision mediump float;
            
            varying vec4 vColor;
            
            void main() {
                vec2 coord = gl_PointCoord - vec2(0.5);
                if (length(coord) > 0.5) {
                    discard;
                }
                float alpha = 1.0 - length(coord) * 2.0;
                gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
            }
        `;
        
        return this.createProgram(vertexShaderSource, fragmentShaderSource);
    }
    
    createProgram(vertexSource, fragmentSource) {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program link error:', this.gl.getProgramInfoLog(program));
            return null;
        }
        
        return program;
    }
    
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    createBuffer(data, type = this.gl.ARRAY_BUFFER) {
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(type, buffer);
        this.gl.bufferData(type, data, this.gl.STATIC_DRAW);
        return buffer;
    }
    
    clear() {
        this.gl.clearColor(0.0, 0.0, 0.1, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
    
    setUniforms(program, uniforms) {
        this.gl.useProgram(program);
        
        for (const [name, value] of Object.entries(uniforms)) {
            const location = this.gl.getUniformLocation(program, name);
            if (location === null) continue;
            
            if (value.length === 16) {
                this.gl.uniformMatrix4fv(location, false, value);
            } else if (value.length === 9) {
                this.gl.uniformMatrix3fv(location, false, value);
            } else if (value.length === 3) {
                this.gl.uniform3fv(location, value);
            } else if (typeof value === 'number') {
                this.gl.uniform1f(location, value);
            }
        }
    }
    
    drawMesh(mesh, uniforms) {
        this.gl.useProgram(this.shaderProgram);
        this.setUniforms(this.shaderProgram, uniforms);
        
        // Bind vertex positions
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh.positionBuffer);
        const positionLocation = this.gl.getAttribLocation(this.shaderProgram, 'aPosition');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 3, this.gl.FLOAT, false, 0, 0);
        
        // Bind normals
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh.normalBuffer);
        const normalLocation = this.gl.getAttribLocation(this.shaderProgram, 'aNormal');
        this.gl.enableVertexAttribArray(normalLocation);
        this.gl.vertexAttribPointer(normalLocation, 3, this.gl.FLOAT, false, 0, 0);
        
        // Bind indices and draw
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        this.gl.drawElements(this.gl.TRIANGLES, mesh.indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
    
    drawParticles(particles) {
        this.gl.useProgram(this.particleProgram);
        
        const positions = [];
        const sizes = [];
        const colors = [];
        
        particles.forEach(particle => {
            positions.push(...particle.position);
            sizes.push(particle.size);
            colors.push(...particle.color);
        });
        
        if (positions.length === 0) return;
        
        // Create buffers
        const positionBuffer = this.createBuffer(new Float32Array(positions));
        const sizeBuffer = this.createBuffer(new Float32Array(sizes));
        const colorBuffer = this.createBuffer(new Float32Array(colors));
        
        // Set uniforms
        this.setUniforms(this.particleProgram, {
            uViewMatrix: this.viewMatrix,
            uProjectionMatrix: this.projectionMatrix
        });
        
        // Bind attributes
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        const positionLocation = this.gl.getAttribLocation(this.particleProgram, 'aPosition');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 3, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, sizeBuffer);
        const sizeLocation = this.gl.getAttribLocation(this.particleProgram, 'aSize');
        this.gl.enableVertexAttribArray(sizeLocation);
        this.gl.vertexAttribPointer(sizeLocation, 1, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
        const colorLocation = this.gl.getAttribLocation(this.particleProgram, 'aColor');
        this.gl.enableVertexAttribArray(colorLocation);
        this.gl.vertexAttribPointer(colorLocation, 4, this.gl.FLOAT, false, 0, 0);
        
        this.gl.drawArrays(this.gl.POINTS, 0, particles.length);
        
        // Clean up
        this.gl.deleteBuffer(positionBuffer);
        this.gl.deleteBuffer(sizeBuffer);
        this.gl.deleteBuffer(colorBuffer);
    }
}

class Mesh {
    constructor(engine, vertices, normals, indices) {
        this.engine = engine;
        this.positionBuffer = engine.createBuffer(new Float32Array(vertices));
        this.normalBuffer = engine.createBuffer(new Float32Array(normals));
        this.indexBuffer = engine.createBuffer(new Uint16Array(indices), engine.gl.ELEMENT_ARRAY_BUFFER);
        this.indexCount = indices.length;
    }
}

// Geometry generators
function createCube(engine, size = 1.0) {
    const s = size / 2;
    const vertices = [
        // Front face
        -s, -s,  s,   s, -s,  s,   s,  s,  s,  -s,  s,  s,
        // Back face
        -s, -s, -s,  -s,  s, -s,   s,  s, -s,   s, -s, -s,
        // Top face
        -s,  s, -s,  -s,  s,  s,   s,  s,  s,   s,  s, -s,
        // Bottom face
        -s, -s, -s,   s, -s, -s,   s, -s,  s,  -s, -s,  s,
        // Right face
         s, -s, -s,   s,  s, -s,   s,  s,  s,   s, -s,  s,
        // Left face
        -s, -s, -s,  -s, -s,  s,  -s,  s,  s,  -s,  s, -s
    ];
    
    const normals = [
        // Front face
         0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,
        // Back face
         0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,
        // Top face
         0,  1,  0,   0,  1,  0,   0,  1,  0,   0,  1,  0,
        // Bottom face
         0, -1,  0,   0, -1,  0,   0, -1,  0,   0, -1,  0,
        // Right face
         1,  0,  0,   1,  0,  0,   1,  0,  0,   1,  0,  0,
        // Left face
        -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0
    ];
    
    const indices = [
         0,  1,  2,   0,  2,  3,    // front
         4,  5,  6,   4,  6,  7,    // back
         8,  9, 10,   8, 10, 11,    // top
        12, 13, 14,  12, 14, 15,    // bottom
        16, 17, 18,  16, 18, 19,    // right
        20, 21, 22,  20, 22, 23     // left
    ];
    
    return new Mesh(engine, vertices, normals, indices);
}

function createSphere(engine, radius = 1.0, segments = 16) {
    const vertices = [];
    const normals = [];
    const indices = [];
    
    for (let lat = 0; lat <= segments; lat++) {
        const theta = lat * Math.PI / segments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        
        for (let lon = 0; lon <= segments; lon++) {
            const phi = lon * 2 * Math.PI / segments;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            
            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;
            
            vertices.push(radius * x, radius * y, radius * z);
            normals.push(x, y, z);
            
            if (lat < segments && lon < segments) {
                const first = lat * (segments + 1) + lon;
                const second = first + segments + 1;
                
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
    }
    
    return new Mesh(engine, vertices, normals, indices);
} 