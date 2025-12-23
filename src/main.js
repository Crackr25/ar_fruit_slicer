import { FruitGame } from './game/FruitGame.js';
import { ShooterGame } from './game/ShooterGame.js';
import { DrawingGame } from './game/DrawingGame.js';
import { TelekinesisGame } from './game/TelekinesisGame.js';
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
      btnDrawing: document.getElementById('btn-drawing'),
      btnTelekinesis: document.getElementById('btn-telekinesis'),
      gameOver: document.getElementById('game-over'),
      restartBtn: document.getElementById('restart-btn'),
    };

    this.ui.btnFruit.addEventListener('click', () => this.startGame('fruit'));
    this.ui.btnShooter.addEventListener('click', () => this.startGame('shooter'));
    this.ui.btnDrawing.addEventListener('click', () => this.startGame('drawing'));
    this.ui.btnTelekinesis.addEventListener('click', () => this.startGame('telekinesis'));
    this.ui.restartBtn.addEventListener('click', () => this.restartGame());
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

  restartGame() {
    // Just re-show menu? Or restart current game?
    // For now, let's just go back to Main Menu to let them choose again.
    // Simplifies logic.
    if (this.currentGame) {
      this.currentGame.stop();
      this.currentGame = null;
    }
    this.ui.gameOver.classList.add('hidden');
    this.ui.menu.style.display = 'flex';
  }

  startGame(type) {
    if (this.currentGame) {
      this.currentGame.stop();
    }

    this.ui.menu.style.display = 'none';
    this.ui.gameOver.classList.add('hidden');

    if (type === 'fruit') {
      this.currentGame = new FruitGame(this.video, this.handTracker);
    } else if (type === 'shooter') {
      this.currentGame = new ShooterGame(this.video, this.handTracker);
    } else if (type === 'drawing') {
      this.currentGame = new DrawingGame(this.video, this.handTracker);
    } else if (type === 'telekinesis') {
      this.currentGame = new TelekinesisGame(this.video, this.handTracker);
    }

    this.currentGame.start();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
