export class ShooterGame {
    constructor(video, handTracker) {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = video;
        this.handTracker = handTracker;

        this.ui = {
            loading: document.getElementById('loading'),
            score: document.getElementById('score'),
            lives: document.getElementById('lives'),
        };

        this.isRunning = false;
        this.lastTime = 0;
        this.score = 0;
        this.lives = 5;

        this.enemies = [];
        this.projectiles = [];
        this.crosshair = null;
        this.spawnTimer = 0;

        // Input state
        this.lastHandPos = null;
        this.wasRecoiling = false;

        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);
        this.resize();
    }

    start() {
        this.isRunning = true;
        this.score = 0;
        this.lives = 5;
        this.enemies = [];
        this.projectiles = [];
        this.lastHandPos = null;
        this.wasRecoiling = false;

        this.ui.score.innerText = `Score: ${this.score}`;
        this.ui.lives.innerText = `Shields: ${this.lives}`;
        this.ui.score.style.display = 'block';
        this.ui.lives.style.display = 'block';

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
        // 1. Detect Hands
        const landmarks = this.handTracker.detect(this.video);
        let handPos = null;
        let isPinching = false;

        if (landmarks && landmarks.landmarks && landmarks.landmarks.length > 0) {
            const hand = landmarks.landmarks[0];
            const indexTip = hand[8];
            const thumbTip = hand[4];

            // Map to canvas coords
            handPos = this.mapCoordinates(indexTip.x, indexTip.y);

            // 2. Pinch Detection (Auto-Fire)
            const dx = indexTip.x - thumbTip.x;
            const dy = indexTip.y - thumbTip.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Threshold for pinch (normalized approx 0.05-0.08)
            if (dist < 0.08) {
                isPinching = true;
                // Rapid Fire Logic
                this.shootTimer -= dt;
                if (this.shootTimer <= 0) {
                    this.shoot(handPos);
                    this.shootTimer = 0.15; // Fire rate: every 150ms
                }
            } else {
                this.shootTimer = 0; // Reset timer so next pinch fires immediately
            }

            this.crosshair = handPos;
            this.isPinching = isPinching; // For visual feedback

        } else {
            this.crosshair = null;
            this.isPinching = false;
        }

        // 3. Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            this.projectiles[i].life -= dt * 5;
            if (this.projectiles[i].life <= 0) this.projectiles.splice(i, 1);
        }

        // 4. Update Enemies
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            this.spawnTimer = Math.max(0.5, 2.0 - this.score * 0.001); // Faster spawn
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            enemy.x += enemy.vx * dt;
            enemy.y += enemy.vy * dt;

            // Bounce off edges
            if (enemy.x < 0 || enemy.x > this.canvas.width) enemy.vx *= -1;
            if (enemy.y < 0 || enemy.y > this.canvas.height) enemy.vy *= -1;

            enemy.life -= dt;
            if (enemy.life <= 0) {
                // Escaped / Exploded on player
                this.lives--;
                this.ui.lives.innerText = `Shields: ${this.lives}`;
                this.enemies.splice(i, 1);
                if (this.lives <= 0) {
                    this.gameOver();
                }
            }
        }
    }

    shoot(pos) {
        this.projectiles.push({ x: pos.x, y: pos.y, life: 1.0 });

        // Hitscan Check
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const dx = enemy.x - pos.x;
            const dy = enemy.y - pos.y;
            const r = enemy.size + 40; // Generous Hitbox

            if (dx * dx + dy * dy < r * r) {
                // Hit!
                this.enemies.splice(i, 1);
                this.score += 100;
                this.ui.score.innerText = `Score: ${this.score}`;
            }
        }
    }

    spawnEnemy() {
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height;
        this.enemies.push({
            x, y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            size: 40,
            color: '#FF0000',
            life: 5.0
        });
    }

    gameOver() {
        this.isRunning = false;
        document.getElementById('final-score').innerText = this.score;
        document.getElementById('game-over').classList.remove('hidden');
    }

    mapCoordinates(normX, normY) {
        // Simple fullscreen map, mirror X
        return {
            x: (1 - normX) * this.canvas.width,
            y: normY * this.canvas.height
        };
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

        // 2. Draw PIP Video (Bottom Left) - Same as FruitGame
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

        // 3. Enemies
        for (const enemy of this.enemies) {
            this.ctx.fillStyle = enemy.color;
            this.ctx.beginPath();
            this.ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
            this.ctx.fill();

            // Health ring
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(enemy.x, enemy.y, enemy.size + 5, 0, Math.PI * 2 * (enemy.life / 5.0));
            this.ctx.stroke();
        }

        // 4. Beams
        for (const proj of this.projectiles) {
            this.ctx.globalAlpha = proj.life;
            this.ctx.strokeStyle = '#00FF00';
            this.ctx.lineWidth = 8;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#00FF00';

            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, 30, 0, Math.PI * 2);
            this.ctx.stroke();

            // Shockwave
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, 30 + (1 - proj.life) * 50, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.globalAlpha = 1.0;
            this.ctx.shadowBlur = 0;
        }

        // 5. Crosshair
        if (this.crosshair) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 3;
            // Gun Sight Style
            this.ctx.arc(this.crosshair.x, this.crosshair.y, 20, 0, Math.PI * 2);
            this.ctx.moveTo(this.crosshair.x - 30, this.crosshair.y);
            this.ctx.lineTo(this.crosshair.x + 30, this.crosshair.y);
            this.ctx.moveTo(this.crosshair.x, this.crosshair.y - 30);
            this.ctx.lineTo(this.crosshair.x, this.crosshair.y + 30);
            this.ctx.stroke();
        }
    }
}
