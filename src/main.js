import { FruitGame } from './game/FruitGame.js';
import { ShooterGame } from './game/ShooterGame.js';
import { HandTracker } from './game/HandTracker.js';

class App {
  constructor() {
    this.video = document.getElementById('webcam');
    this.handTracker = new HandTracker();
    this.currentGame = null;

    this.ui = {
      menu: document.getElementById('main-menu'),
      loading: document.getElementById('loading'),
      btnFruit: document.getElementById('btn-fruit'),
      btnShooter: document.getElementById('btn-shooter'),
      gameOver: document.getElementById('game-over'),
      restartBtn: document.getElementById('restart-btn'),
    };

    this.ui.btnFruit.addEventListener('click', () => this.startGame('fruit'));
    this.ui.btnShooter.addEventListener('click', () => this.startGame('shooter'));
    this.ui.restartBtn.addEventListener('click', () => this.restartGame()); // Global restart handler?
    // Note: Individual games handle their own logic loop, but they share the UI "Game Over" restart.
    // Actually, FruitGame had its own internal logic for restart. 
    // Let's modify FruitGame to allow external control or keep it self-contained.
    // For now, simple: Dispose old game, create new one.
  }

  async init() {
    this.ui.menu.style.display = 'none';
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
      this.ui.menu.style.display = 'flex';

    } catch (error) {
      console.error("Initialization failed:", error);
      this.ui.loading.innerText = `Error: ${error.message}`;
    }
  }

  startGame(type) {
    if (this.currentGame) {
      this.currentGame.stop();
    }

    this.ui.menu.style.display = 'none';
    this.ui.gameOver.classList.add('hidden'); // Ensure game over is hidden

    if (type === 'fruit') {
      this.currentGame = new FruitGame(this.video, this.handTracker);
    } else if (type === 'shooter') {
      this.currentGame = new ShooterGame(this.video, this.handTracker);
    }

    this.currentGame.start();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
