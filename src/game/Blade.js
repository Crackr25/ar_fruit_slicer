export class Blade {
    constructor(color = '#00ffff', maxPoints = 10) {
        this.points = [];
        this.color = color;
        this.maxPoints = maxPoints;
    }

    addPoint(x, y) {
        this.points.push({ x, y, life: 1.0 });
        if (this.points.length > this.maxPoints) {
            this.points.shift();
        }
    }

    update(dt) {
        // Fade out points
        for (let i = this.points.length - 1; i >= 0; i--) {
            this.points[i].life -= dt * 5; // Fade speed
            if (this.points[i].life <= 0) {
                this.points.splice(i, 1);
            }
        }
    }

    render(ctx) {
        if (this.points.length < 2) return;

        // 1. Draw Trail (Motion Blur)
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4; // Thinner trail

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.stroke();
        ctx.restore();

        // 2. Draw Floating Sword at Latest Point
        const pLast = this.points[this.points.length - 1];
        const pPrev = this.points[this.points.length - 2] || { x: pLast.x, y: pLast.y + 1 }; // Fallback

        // Calculate Angle
        const dx = pLast.x - pPrev.x;
        const dy = pLast.y - pPrev.y;
        let angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(pLast.x, pLast.y);
        ctx.rotate(angle);

        // Draw Sword Relative to (0,0) being the hand position (center of hilt)

        // Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00FFFF';

        // Hilt
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(-10, -3, 20, 6);

        // Crossguard
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.fillRect(8, -10, 5, 20);

        // Blade (Extending to the right, consistent with angle=0)
        ctx.fillStyle = '#E0FFFF'; // Light Blue-White
        ctx.beginPath();
        ctx.moveTo(13, -4);
        ctx.lineTo(100, 0); // Tip
        ctx.lineTo(13, 4);
        ctx.fill();

        // Shiny Core
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.lineTo(90, 0);
        ctx.stroke();

        ctx.restore();
    }
}
