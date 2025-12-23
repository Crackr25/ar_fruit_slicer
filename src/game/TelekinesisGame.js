export class TelekinesisGame {
    constructor(video, handTracker) {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = video;
        this.handTracker = handTracker;

        this.ui = {
            loading: document.getElementById('loading'),
            score: document.getElementById('score'),
            lives: document.getElementById('lives'), // Reuse for "Force" meter?
        };

        this.isRunning = false;
        this.lastTime = 0;

        // Physics Objects
        this.box = {
            x: 0, y: 0, z: 200, // World Coords (0,0 is screen center)
            vx: 0, vy: 0, vz: 0,
            ax: 0, ay: 0, az: 0,
            rotation: { x: 0, y: 0, z: 0 },
            rv: { x: 0.01, y: 0.02, z: 0.01 }, // Angular velocity
            size: 100
        };

        // Input Physics
        this.lastHandPos = null;
        this.handVelocity = { x: 0, y: 0 };
        this.targetPos = null; // Where the box "wants" to go (Hand Pos)

        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);
        this.resize();
    }

    start() {
        this.isRunning = true;
        this.box.x = 0; this.box.y = 0; this.box.z = 200;
        this.box.vx = 0; this.box.vy = 0; this.box.vz = 0;

        this.ui.score.innerText = "Super Power Mode";
        this.ui.lives.innerText = "Use hand to Float & Push!";
        this.ui.score.style.display = 'block';
        this.ui.lives.style.display = 'block';
        document.getElementById('game-over').classList.add('hidden');

        this.lastTime = performance.now();
        requestAnimationFrame((time) => this.loop(time));
    }

    stop() {
        this.isRunning = false;
        this.ui.score.style.display = 'none';
        this.ui.lives.style.display = 'none';
        window.removeEventListener('resize', this.resizeHandler);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    loop(time) {
        if (!this.isRunning) return;
        const deltaTime = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.update(deltaTime);
        this.render();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // 1. Detect Hand
        const landmarks = this.handTracker.detect(this.video);

        // 2-Hand Control: FREEZE
        if (landmarks && landmarks.landmarks && landmarks.landmarks.length >= 2) {
            this.ui.lives.innerText = "*** STASIS FIELD ACTIVE ***";
            // Freeze velocity immediately
            this.box.vx *= 0.1;
            this.box.vy *= 0.1;
            this.box.vz *= 0.1;
            this.box.rv.x *= 0.1;
            this.box.rv.y *= 0.1;
            this.box.rv.z *= 0.1;

            this.lastHandPos = null;
            return;
        } else {
            this.ui.lives.innerText = "Pinch to ZOOM | Use hand to Move";
        }

        if (landmarks && landmarks.landmarks && landmarks.landmarks.length > 0) {
            const hand = landmarks.landmarks[0];
            const indexTip = hand[8];
            const thumbTip = hand[4];

            // Map 0-1 to Canvas Coordinates
            const targetX = (1 - indexTip.x) * this.canvas.width;
            const targetY = indexTip.y * this.canvas.height;

            // World Center Relative
            const worldTargetX = targetX - this.canvas.width / 2;
            const worldTargetY = targetY - this.canvas.height / 2;

            // PINCH DETECTION (Zoom)
            const pdx = indexTip.x - thumbTip.x;
            const pdy = indexTip.y - thumbTip.y;
            const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
            const isPinching = pDist < 0.08;

            // Z-Axis Logic (Zoom)
            // Default target Z = 300 (Far)
            // Pinch target Z = 50 (Close/Zoomed)
            const targetZ = isPinching ? 0 : 300;

            // Tracking Physics
            if (this.lastHandPos) {
                const vx = (worldTargetX - this.lastHandPos.x) / dt;
                const vy = (worldTargetY - this.lastHandPos.y) / dt;
                this.handVelocity = { x: vx, y: vy };

                const dx = worldTargetX - this.box.x;
                const dy = worldTargetY - this.box.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 300) {
                    const speed = Math.sqrt(vx * vx + vy * vy);

                    if (speed > 800) {
                        // SUPER PUSH / SLAM
                        this.box.vx += vx * 0.2;
                        this.box.vy += vy * 0.2;
                        this.box.vz += 200; // Knock back

                        this.box.rv.x += vy * 0.0005;
                        this.box.rv.y += -vx * 0.0005;
                    } else {
                        // TELEKINESIS: Guided Float
                        const k = 4.0;
                        const kz = 2.0;

                        this.box.ax = (worldTargetX - this.box.x) * k;
                        this.box.ay = (worldTargetY - this.box.y) * k;
                        this.box.az = (targetZ - this.box.z) * kz; // Pull to Z

                        // Add Hand Momentum
                        this.box.vx += vx * dt * 2.0;
                        this.box.vy += vy * dt * 2.0;
                    }
                } else {
                    // Weak pull + Return to Z Depth
                    this.box.ax = (worldTargetX - this.box.x) * 0.5;
                    this.box.ay = (worldTargetY - this.box.y) * 0.5;
                    this.box.az = (300 - this.box.z) * 1.0;
                }
            } else {
                this.box.ax = 0;
                this.box.ay = 0;
                this.box.az = (300 - this.box.z) * 0.5; // Return to standard depth
            }

            this.lastHandPos = { x: worldTargetX, y: worldTargetY };

        } else {
            this.lastHandPos = null;
            // Float to center and depth
            this.box.ax = -this.box.x * 0.2;
            this.box.ay = -this.box.y * 0.2;
            this.box.az = (300 - this.box.z) * 0.2;
        }

        // Physics Integration
        const drag = 0.95;
        this.box.vx += this.box.ax * dt;
        this.box.vy += this.box.ay * dt;
        this.box.vz += this.box.az * dt;

        this.box.vx *= drag;
        this.box.vy *= drag;
        this.box.vz *= drag;

        this.box.x += this.box.vx * dt;
        this.box.y += this.box.vy * dt;
        this.box.z += this.box.vz * dt;

        const fov = 1000; // Helper for Z clamping
        // Clamp Z to avoid clipping behind camera or too far
        if (this.box.z < -fov + 50) { this.box.z = -fov + 50; this.box.vz = 0; } // Near Clip

        // 3D Rotation tumbling
        this.box.rotation.x += this.box.rv.x;
        this.box.rotation.y += this.box.rv.y;
        this.box.rotation.z += this.box.rv.z;

        // Bounds (Bounce off screen edges roughly)
        const boundX = this.canvas.width / 2 - 50;
        const boundY = this.canvas.height / 2 - 50;

        if (this.box.x < -boundX) { this.box.x = -boundX; this.box.vx *= -0.8; }
        if (this.box.x > boundX) { this.box.x = boundX; this.box.vx *= -0.8; }
        if (this.box.y < -boundY) { this.box.y = -boundY; this.box.vy *= -0.8; }
        if (this.box.y > boundY) { this.box.y = boundY; this.box.vy *= -0.8; }


        // Update Particles
        if (!this.particles) this.particles = [];
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            p.size -= dt * 10;
            if (p.life <= 0 || p.size <= 0) this.particles.splice(i, 1);
        }
    }

    render() {
        // 1. Background (Dark Gradient)
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 100,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.width
        );
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f1a');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Camera (Full Screen Background? Box needs to look real)
        // Let's draw Camera full screen for immersion
        this.ctx.save();
        this.ctx.translate(this.canvas.width, 0);
        this.ctx.scale(-1, 1);
        if (this.video && this.video.readyState >= 2) {
            const videoRatio = this.video.videoWidth / this.video.videoHeight;
            const screenRatio = this.canvas.width / this.canvas.height;
            let dw, dh, sx, sy;
            if (screenRatio > videoRatio) {
                dw = this.canvas.width;
                dh = this.canvas.width / videoRatio;
                sx = 0; sy = (this.canvas.height - dh) / 2;
            } else {
                dh = this.canvas.height;
                dw = this.canvas.height * videoRatio;
                sx = (this.canvas.width - dw) / 2; sy = 0;
            }
            this.ctx.drawImage(this.video, sx, sy, dw, dh);
        }
        this.ctx.restore();

        // 3. Draw Particles (Behind objects?)
        this.ctx.globalCompositeOperation = 'lighter'; // Additive blending for fire
        for (const p of this.particles || []) {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalCompositeOperation = 'source-over';

        // 4. Draw 3D Box
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;

        const vertices = [
            { x: -1, y: -1, z: -1 },
            { x: 1, y: -1, z: -1 },
            { x: 1, y: 1, z: -1 },
            { x: -1, y: 1, z: -1 },
            { x: -1, y: -1, z: 1 },
            { x: 1, y: -1, z: 1 },
            { x: 1, y: 1, z: 1 },
            { x: -1, y: 1, z: 1 }
        ];

        // Scale and Rotate Vertices
        const projected = [];
        const size = this.box.size;

        // Rotation Matrices (Standard Euler)
        const rx = this.box.rotation.x;
        const ry = this.box.rotation.y;
        const rz = this.box.rotation.z;

        for (let v of vertices) {
            // Scale
            let x = v.x * size;
            let y = v.y * size;
            let z = v.z * size;

            // Rotate X
            let y1 = y * Math.cos(rx) - z * Math.sin(rx);
            let z1 = y * Math.sin(rx) + z * Math.cos(rx);
            y = y1; z = z1;

            // Rotate Y
            let x1 = x * Math.cos(ry) + z * Math.sin(ry);
            let z2 = -x * Math.sin(ry) + z * Math.cos(ry);
            x = x1; z = z2;

            // Rotate Z
            let x2 = x * Math.cos(rz) - y * Math.sin(rz);
            let y2 = x * Math.sin(rz) + y * Math.cos(rz);
            x = x2; y = y2;

            // Translate
            x += this.box.x;
            y += this.box.y;
            z += this.box.z; // Depth relative to camera

            // Project Perspective
            const fov = 1000;
            const scale = fov / (fov + z);
            const sx = x * scale + cx;
            const sy = y * scale + cy;

            projected.push({ x: sx, y: sy });
        }

        // Draw Edges
        this.ctx.strokeStyle = '#00FFFF';
        this.ctx.lineWidth = 4;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#00FFFF';
        this.ctx.beginPath();

        const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0], // Front Face?
            [4, 5], [5, 6], [6, 7], [7, 4], // Back Face?
            [0, 4], [1, 5], [2, 6], [3, 7]  // Connecting
        ];

        for (let e of edges) {
            const p1 = projected[e[0]];
            const p2 = projected[e[1]];
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
        }
        this.ctx.stroke();

        // Hand Visual (Force Indicator with Fire)
        if (this.lastHandPos) {
            const hx = this.lastHandPos.x + cx;
            const hy = this.lastHandPos.y + cy;

            // Emit Particles
            if (!this.particles) this.particles = [];
            for (let i = 0; i < 5; i++) {
                this.particles.push({
                    x: hx + (Math.random() - 0.5) * 20,
                    y: hy + (Math.random() - 0.5) * 20,
                    vx: (Math.random() - 0.5) * 100,
                    vy: (Math.random() - 0.5) * 100 - 100, // Rise up
                    life: 0.5 + Math.random() * 0.5,
                    size: 10 + Math.random() * 15,
                    color: `hsla(${10 + Math.random() * 40}, 100%, 50%, 0.8)` // Orange/Fire
                });
            }

            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(hx, hy, 20, 0, Math.PI * 2);
            this.ctx.fill();

            // Line to box center (Force Beam)
            this.ctx.beginPath();
            this.ctx.moveTo(hx, hy);
            // Box center proj:
            const fov = 1000;
            const z = this.box.z;
            const scale = fov / (fov + z);
            const bx = this.box.x * scale + cx;
            const by = this.box.y * scale + cy;

            this.ctx.lineTo(bx, by);
            this.ctx.lineWidth = 2; // Beaming
            this.ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)'; // Orange Beam
            this.ctx.stroke();
        }

        this.ctx.shadowBlur = 0;
    }
}
