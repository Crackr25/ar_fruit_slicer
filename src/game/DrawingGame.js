export class DrawingGame {
    constructor(video, handTracker) {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = video;
        this.handTracker = handTracker;

        this.ui = {
            loading: document.getElementById('loading'),
            score: document.getElementById('score'), // Reuse score for timer/prompt
            lives: document.getElementById('lives'), // Reuse lives for "Drawing Mode" status
        };

        this.isRunning = false;
        this.lastTime = 0;

        // Game State
        this.prompts = ["House", "Car", "Sun", "Smile", "Flower", "Tree", "Cat", "Pizza"];
        this.currentPrompt = "";
        this.timeLeft = 30;
        this.inkAmount = 0;

        // Drawing Storage
        this.paths = []; // Array of arrays of points [{x,y}, ...]
        this.currentPath = null;
        this.isPinching = false;
        this.brushColor = `hsl(${Math.random() * 360}, 100%, 70%)`;

        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);
        this.resize();
    }

    start() {
        this.isRunning = true;
        this.paths = [];
        this.currentPath = null;
        this.timeLeft = 30;
        this.inkAmount = 0;
        this.currentPrompt = this.prompts[Math.floor(Math.random() * this.prompts.length)];

        this.ui.score.innerText = `Draw: ${this.currentPrompt} (${this.timeLeft}s)`;
        this.ui.lives.innerText = "Pinch to Draw!";
        this.ui.score.style.display = 'block';
        this.ui.lives.style.display = 'block';
        document.getElementById('game-over').classList.add('hidden'); // Ensure hidden

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
        // 1. Timer
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
            this.finishDrawing();
            return;
        }
        this.ui.score.innerText = `Draw: ${this.currentPrompt} (${Math.ceil(this.timeLeft)}s)`;

        // 2. Hand Tracking
        const landmarks = this.handTracker.detect(this.video);
        let handPos = null;

        if (landmarks && landmarks.landmarks && landmarks.landmarks.length > 0) {
            const hand = landmarks.landmarks[0];
            const indexTip = hand[8];
            const thumbTip = hand[4];

            handPos = this.mapCoordinates(indexTip.x, indexTip.y);
            this.cursor = handPos;

            // Pinch Detection
            const dx = indexTip.x - thumbTip.x;
            const dy = indexTip.y - thumbTip.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.08) {
                if (!this.isPinching) {
                    // Start new path
                    this.isPinching = true;
                    this.currentPath = [];
                    this.paths.push(this.currentPath);
                    // Cycle color
                    this.brushColor = `hsl(${Math.random() * 360}, 100%, 70%)`;
                }

                // Add point
                if (this.currentPath) {
                    // Optimization: only add if moved far enough
                    const lastPt = this.currentPath[this.currentPath.length - 1];
                    if (!lastPt || Math.hypot(handPos.x - lastPt.x, handPos.y - lastPt.y) > 5) {
                        this.currentPath.push(handPos);
                        this.inkAmount += 1;
                    }
                }
            } else {
                this.isPinching = false;
                this.currentPath = null;
            }
        } else {
            this.cursor = null;
            this.isPinching = false;
            this.currentPath = null;
        }
    }

    mapCoordinates(normX, normY) {
        return {
            x: (1 - normX) * this.canvas.width,
            y: normY * this.canvas.height
        };
    }

    finishDrawing() {
        this.isRunning = false;

        // Calculate "Mock" Score
        // Factors: Ink Amount, Number of strokes (paths), Random "Taste"
        let score = 0;

        // Coverage check (bounds)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let totalPoints = 0;

        for (const path of this.paths) {
            for (const pt of path) {
                minX = Math.min(minX, pt.x);
                maxX = Math.max(maxX, pt.x);
                minY = Math.min(minY, pt.y);
                maxY = Math.max(maxY, pt.y);
                totalPoints++;
            }
        }

        if (totalPoints > 50) {
            // Did they draw something substantial?
            const width = maxX - minX;
            const height = maxY - minY;
            const area = width * height;
            const screenArea = this.canvas.width * this.canvas.height;
            const coverage = area / screenArea;

            // Too small? Low score. Too big? Good score.
            let coverageScore = Math.min(100, coverage * 200);

            // Detail score (points count)
            let detailScore = Math.min(100, totalPoints / 5);

            // Random "AI" opinion
            let aiScore = Math.random() * 20;

            score = Math.floor((coverageScore * 0.4) + (detailScore * 0.4) + aiScore);
            score = Math.min(100, Math.max(10, score)); // Clamp
        } else {
            score = 0; // Laziness punishment
        }

        const gameOverEl = document.getElementById('game-over');
        gameOverEl.querySelector('h1').innerText = "Judging Complete!";
        document.getElementById('final-score').innerText = `${score}/100`;
        gameOverEl.classList.remove('hidden');
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

        // 2. Camera Feed (Corner PIP)
        const pipW = 320;
        const pipH = 240;
        const pipX = 20;
        const pipY = this.canvas.height - pipH - 20;

        this.ctx.save();
        this.ctx.translate(pipX + pipW, pipY);
        this.ctx.scale(-1, 1);
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, pipW, pipH);
        if (this.video && this.video.readyState >= 2) {
            this.ctx.drawImage(this.video, 0, 0, pipW, pipH);
        }
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, pipW, pipH);
        this.ctx.restore();

        // 3. Draw Paths (The Art)
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        let pathIndex = 0;
        for (const path of this.paths) {
            if (path.length < 2) continue;

            // Colors! Rainbow if we want, or stored per path?
            // For now, random neon colors stored?
            // Simpler: use a nice neon loop based on index
            const hue = (pathIndex * 20) % 360;
            this.ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
            this.ctx.lineWidth = 8;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = this.ctx.strokeStyle;

            this.ctx.beginPath();
            this.ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                this.ctx.lineTo(path[i].x, path[i].y);
            }
            this.ctx.stroke();
            pathIndex++;
        }

        this.ctx.shadowBlur = 0;

        // 4. Cursor
        if (this.cursor) {
            this.ctx.strokeStyle = this.isPinching ? '#00FF00' : '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.cursor.x, this.cursor.y, 10, 0, Math.PI * 2);
            this.ctx.stroke();

            if (this.isPinching) {
                this.ctx.fillStyle = '#00FF00';
                this.ctx.fill();
            }
        }
    }
}
