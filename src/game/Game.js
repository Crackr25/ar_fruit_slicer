import { HandTracker } from './HandTracker.js';
import { Blade } from './Blade.js';
import { Fruit } from './Fruit.js';

export class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('webcam');
        this.ui = {
            loading: document.getElementById('loading'),
            score: document.getElementById('score'),
            gameOver: document.getElementById('game-over'),
            finalScore: document.getElementById('final-score'),
            restartBtn: document.getElementById('restart-btn'),
            lives: document.getElementById('lives'),
        };

        this.handTracker = new HandTracker();
        this.blade = new Blade('#ffffff');
        this.fruits = [];

        this.isRunning = false;
        this.lastTime = 0;

        this.score = 0;
        this.lives = 20;
        this.spawnTimer = 0;
        this.spawnInterval = 2.0;
        this.gameDifficulty = 1;

        // Resize canvas to match window
        window.addEventListener('resize', () => this.resize());
        this.resize();

        this.ui.restartBtn.addEventListener('click', () => this.restartGame());
    }

    async init() {
        this.ui.loading.style.display = 'block';

        try {
            // Setup Camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });
            this.video.srcObject = stream;
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });

            // Setup MediaPipe
            await this.handTracker.init();

            this.ui.loading.style.display = 'none';
            this.startGame();
        } catch (error) {
            console.error("Initialization failed:", error);
            this.ui.loading.innerText = `Error: ${error.message}`;
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    startGame() {
        this.isRunning = true;
        this.score = 0;
        this.lives = 20;
        this.ui.lives.innerText = `Lives: ${this.lives}`;
        this.spawnInterval = 2.0;
        this.gameDifficulty = 1;
        this.fruits = [];
        this.blade = new Blade('#ffffff');
        this.ui.score.innerText = `Score: ${this.score}`;
        this.ui.gameOver.classList.add('hidden');
        this.lastTime = performance.now();
        requestAnimationFrame((time) => this.loop(time));
    }

    restartGame() {
        this.startGame();
    }

    gameOver() {
        this.isRunning = false;
        this.ui.finalScore.innerText = this.score;
        this.ui.gameOver.classList.remove('hidden');
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
        // 1. Detect Hands
        const landmarks = this.handTracker.detect(this.video);
        let handPos = null;

        if (landmarks && landmarks.landmarks && landmarks.landmarks.length > 0) {
            // Use the first detected hand, index finger tip (8)
            const hand = landmarks.landmarks[0];
            const indexTip = hand[8];

            // Map to canvas coords
            handPos = this.mapCoordinates(indexTip.x, indexTip.y);

            // Update Blade
            this.blade.addPoint(handPos.x, handPos.y);
        }

        this.blade.update(dt);

        // 2. Spawn Fruits
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnFruit();
            // Decrease interval slightly as difficulty increases
            this.spawnInterval = Math.max(0.5, 2.0 - this.gameDifficulty * 0.1);
            this.spawnTimer = this.spawnInterval;
        }

        // 3. Update Fruits & Collision
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const fruit = this.fruits[i];
            fruit.update(dt); // Gravity is default arg

            // Remove if off screen (only if fell below bottom)
            if (fruit.y > this.canvas.height + 100) {
                if (!fruit.sliced) {
                    // Missed fruit!
                    this.lives--;
                    this.ui.lives.innerText = `Lives: ${this.lives}`;
                    if (this.lives <= 0) {
                        this.gameOver();
                        return; // Stop updating this frame
                    }
                }
                this.fruits.splice(i, 1);
                continue;
            }

            // check collision with blade
            if (!fruit.sliced && handPos) {
                if (this.checkSlice(fruit)) {
                    fruit.sliced = true;
                    fruit.vx *= -1; // Split effect: bounce off
                    fruit.vy = -200; // Hop up a bit
                    this.score += 10;
                    this.ui.score.innerText = `Score: ${this.score}`;

                    // Increase difficulty
                    this.gameDifficulty++;
                }
            }
        }
    }

    mapCoordinates(normX, normY) {
        // Since new design, we map 0-1 from MediaPipe (video frame) 
        // to Full Screen Canvas Area directly.
        // We want the sword to cover the whole screen, even if the user's hand is just in the video frame.

        // Mirror Logic:
        // Textures/Game World is NOT mirrored (0,0 is top left).
        // But Input IS coming from a mirrored video.
        // MP normX=0 (Left of Video) -> Should be Right Side of Screen (Mirror)
        // MP normX=1 (Right of Video) -> Should be Left Side of Screen (Mirror)

        // So: x = (1 - normX) * width

        return {
            x: (1 - normX) * this.canvas.width,
            y: normY * this.canvas.height
        };
    }

    spawnFruit() {
        // Target x center
        const width = this.canvas.width;
        const padding = 100;

        // Spawn from bottom 
        const x = padding + Math.random() * (width - 2 * padding);
        const y = this.canvas.height;

        const centerX = width / 2;
        const vx = (centerX - x) * (Math.random() * 0.5 + 0.5);
        const vy = -(Math.random() * 300 + 700); // Upward force

        const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF9F43'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        this.fruits.push(new Fruit(x, y, vx, vy, color));
    }

    checkSlice(fruit) {
        if (this.blade.points.length < 2) return false;

        const p1 = this.blade.points[this.blade.points.length - 2];
        const p2 = this.blade.points[this.blade.points.length - 1];

        // Check intersection between line segment (p1, p2) and circle (fruit.x, fruit.y, fruit.size)
        return this.lineIntersectsCircle(p1, p2, { x: fruit.x, y: fruit.y, r: fruit.size });
    }

    lineIntersectsCircle(p1, p2, circle) {
        // Vector subtract
        const d = { x: p2.x - p1.x, y: p2.y - p1.y };
        const f = { x: p1.x - circle.x, y: p1.y - circle.y };

        const a = d.x * d.x + d.y * d.y;
        const b = 2 * (f.x * d.x + f.y * d.y);
        const c = (f.x * f.x + f.y * f.y) - circle.r * circle.r;

        let discriminant = b * b - 4 * a * c;
        if (discriminant < 0) {
            return false;
        } else {
            // Find intersection points t1 and t2
            discriminant = Math.sqrt(discriminant);
            const t1 = (-b - discriminant) / (2 * a);
            const t2 = (-b + discriminant) / (2 * a);

            // Check if intersection points are within segment [0,1]
            if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1)) {
                return true;
            }
            return false;
        }
    }

    render() {
        // 1. Draw Background (Dark Gradient)
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width / 2, this.canvas.height / 2, 100,
            this.canvas.width / 2, this.canvas.height / 2, this.canvas.width
        );
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#0f0f1a');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Draw PIP Video (Bottom Left)
        // Video is Mirrored for user intuition
        const pipW = 320;
        const pipH = 240;
        const pipX = 20;
        const pipY = this.canvas.height - pipH - 20;

        this.ctx.save();
        this.ctx.translate(pipX + pipW, pipY);
        this.ctx.scale(-1, 1);

        // Border/Box
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, pipW, pipH);

        if (this.video && this.video.readyState >= 2) {
            this.ctx.drawImage(this.video, 0, 0, pipW, pipH);
        }

        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, pipW, pipH);

        this.ctx.restore();

        // 3. Draw Fruits
        for (const fruit of this.fruits) {
            fruit.render(this.ctx);
        }

        // 4. Draw Blade
        this.blade.render(this.ctx);
    }
}
