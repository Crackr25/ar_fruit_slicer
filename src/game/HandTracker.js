import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class HandTracker {
    constructor() {
        this.handLandmarker = undefined;
        this.runningMode = "VIDEO";
        this.lastVideoTime = -1;
        this.results = undefined;
    }

    async init() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: this.runningMode,
            numHands: 2
        });
        console.log("HandLandmarker initialized");
    }

    detect(videoElement) {
        if (!this.handLandmarker) return null;

        let startTimeMs = performance.now();
        if (videoElement.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = videoElement.currentTime;
            this.results = this.handLandmarker.detectForVideo(videoElement, startTimeMs);
        }
        return this.results;
    }
}
