export class Fruit {
    constructor(x, y, vx, vy, color = 'orange', size = 40) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.sliced = false;
        this.markedForDeletion = false;

        // Rotation for visual flair
        this.rotation = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 5;
    }

    update(dt, gravity = 800) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += gravity * dt; // Gravity

        this.rotation += this.rotationSpeed * dt;

        // Cleanup if out of bounds (below screen)
        // Assuming canvas height is handled in the Game class check or here? 
        // We'll let Game class handle "out of bounds" check to access canvas dims, 
        // or loop checks. For now, simple update.
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (!this.sliced) {
            this.drawCompleteFruit(ctx);
        } else {
            // Draw sliced halves
            this.drawSlicedFruit(ctx);
        }

        ctx.restore();
    }

    drawCompleteFruit(ctx) {
        const r = this.size;

        // Shadow
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';

        // Rind/Skin
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Detail (Stripes for watermelon, Texture for orange)
        ctx.shadowBlur = 0;
        if (this.color === '#FF6B6B') { // Watermelonish
            // Green Rind
            ctx.strokeStyle = '#2F855A';
            ctx.lineWidth = 5;
            ctx.stroke();
            // Stripes
            ctx.strokeStyle = '#276749';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-r, -r / 2); ctx.quadraticCurveTo(0, 0, r, -r / 2);
            ctx.moveTo(-r, r / 2); ctx.quadraticCurveTo(0, 0, r, r / 2);
            ctx.stroke();
        } else if (this.color === '#FF9F43') { // Orange
            ctx.fillStyle = '#F6AD55';
            ctx.beginPath();
            ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(-r / 3, -r / 3, r / 4, 0, Math.PI * 2);
        ctx.fill();
    }

    drawSlicedFruit(ctx) {
        const r = this.size;

        // Left Half - Fall away + Rotation logic in update should separate them
        // But here we are drawing one object. Ideally 'sliced' spawns two new objects.
        // For visual simplicity, we draw two separated halves here floating apart.

        // Just Split Effect

        // Piece 1
        ctx.save();
        ctx.translate(-10, 0);
        ctx.rotate(-0.2);

        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI / 2, 3 * Math.PI / 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        // Inner
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r);
        ctx.stroke();

        // Flesh
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, r, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Piece 2
        ctx.save();
        ctx.translate(10, 0);
        ctx.rotate(0.2);

        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        // Flesh
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, r, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
