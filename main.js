import {KNNImageClassifier} from 'deeplearn-knn-image-classifier';
import * as dl from 'deeplearn';

// Number of classes to classify
const NUM_CLASSES = 3;
// Webcam Image size. Must be 227.
const IMAGE_SIZE = 227;
// K value for KNN
const TOPK = 10;
// Train button ids 
const TRAIN_BUTTON_IDS = [
    'train-rock-button',
    'train-paper-button',
    'train-scissors-button',
];
// Span innertext 
const TRAIN_SPAN_IDS = [
    'train-rock-span',
    'train-paper-span',
    'train-scissors-span',
];

const MOVES = [
    'cái búa',
    'tờ giấy',
    'cái kéo',
];

const GESTURE_YOUR_IDS = [
    'rock-you',
    'paper-you',
    'scissors-you',
];

const GESTURE_CPU_IDS = [
    'rock-cpu',
    'paper-cpu',
    'scissors-cpu',
];

const WINNER_MATRIX = [
    [0, 1, -1],
    [-1, 0, 1],
    [1, -1, 0],
];

/**
 * Countdown in game mode 
 */
class CountDownTimer {
    constructor(duration, granularity) {
        this.duration = duration;
        this.granularity = granularity;
        this.tickFns = [];
        this.running = false;
    }

    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        var tickerFn = () => {
            let diff = this.duration - (Date.now() - this.start);
            if (diff > 0) {
                setTimeout(tickerFn, this.granularity);
            } else {
                diff = 0;
                this.running = false;
            }
            this.tickFns.forEach((fn) => {
                fn(diff);
            });
        }
        this.start = Date.now();
        tickerFn();
    }

    get expired() {
        return !this.running();
    }

    addTickFn(fn) {
        this.tickFns.push(fn);
    }
}

/**
 * Main application to start on window load
 */
class Main {
    // Init all variables need for this app 
    constructor() {
        this.videoPlaying = false;
        this.video = document.getElementById('cam-video');
        // Initiate deeplearn.js math and knn classifier objects
        this.knn = new KNNImageClassifier(NUM_CLASSES, TOPK);

        this.training = -1; // -1 when no class is being trained
        this.infoTexts = [];
        this.currentMove = -1;
        this.gaming = false;
        this.firstExampleTrained = false;

        // Create button for starting a game
        this.startButton = document.getElementById('start-game-button');
        this.startButton.onclick = () => {
            this.startGame();
        };

        this.gameStatus = document.getElementById('game-status');

        this.gestureYouImages = GESTURE_YOUR_IDS.map((val) => {
            return document.getElementById(val);
        });

        this.gestureCpuImages = GESTURE_CPU_IDS.map((val) => {
            return document.getElementById(val);
        });

        this.youImg = document.getElementById('you');
        this.hiddenCanvas = document.createElement('canvas');
        this.hiddenCanvas.width = IMAGE_SIZE;
        this.hiddenCanvas.height = IMAGE_SIZE;

        // Add event listener into buttons 
        for (let i = 0; i < NUM_CLASSES; i++) {
            let button = document.getElementById(TRAIN_BUTTON_IDS[i]);
            button.addEventListener('mousedown', () => {
                this.training = i;
                button.innerText = `Đang học ${MOVES[i]}...`;
            });
            button.addEventListener('mouseup', () => {
                this.training = -1;
                button.innerText = `Học hình ${MOVES[i]}...`;
            });
            this.infoTexts.push(document.getElementById(TRAIN_SPAN_IDS[i]));
        }

        // Setup webcam
        navigator.mediaDevices.getUserMedia({video: true, audio: false})
        .then((stream) => {
            this.video.srcObject = stream;
            this.video.width = IMAGE_SIZE;
            this.video.height = IMAGE_SIZE;

            this.video.addEventListener('playing', ()=> this.videoPlaying = true);
            this.video.addEventListener('paused', ()=> this.videoPlaying = false);
        });

        // Load knn model
        this.knn.load()
        .then(() => this.start());
    }

    /**
     * Start the main deeplearn.js loop
     */
    start() {
        this.video.play();
        this.timer = requestAnimationFrame(this.execute.bind(this));
    }

    /**
     * Start a game of rock-paper-scissors
     */
    startGame() {
        if (this.startButton.disabled) {
            return;
        }
        console.log('Go here');
        this.gaming = true;
        this.startButton.disabled = true;
        this.countDownTimer = new CountDownTimer(5000, 20);
        this.countDownTimer.addTickFn((msLeft) => {
            this.gameStatus.innerText = (msLeft/1000).toFixed(1) +
            ' giây còn lại. Hãy chuẩn bị ra đòn đánh bại đối thủ.';
            let computerMove = Math.floor(Math.random()*3);
            for (let i = 0; i < 3; i++) {
                this.gestureCpuImages[i].hidden = (i !== computerMove);
            }
            if (msLeft == 0) {
                this.resolveGame();
            }
        });
        this.countDownTimer.start();
    }

    /**
     * Resolve the game
     */
    resolveGame() {
        this.gaming = false;
        let computerMove = Math.floor(Math.random()*3);
        let result = WINNER_MATRIX[computerMove][this.currentMove];
        switch (result) {
            case -1:
                this.gameStatus.innerText = 'Bạn thua rồi. Hãy thử lại nhé';
                break;
            case 0:
                this.gameStatus.innerText = `Không phân thắng bại. Hãy thử lại nhé. `;
                break;
            case 1:
                this.gameStatus.innerText = 'Xin chúc mừng. Bạn đã chiến thắng!';
        }
        for (let i = 0; i < 3; i++) {
            this.gestureCpuImages[i].hidden = (i !== computerMove);
        }
        this.startButton.disabled = false;
        this.hiddenCanvas.getContext('2d').drawImage(
        this.video, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
        this.youImg.src = this.hiddenCanvas.toDataURL();
        this.youImg.onload = () => {
            for (let i = 0; i < 3; i++) {
                this.gestureYouImages[i].hidden = true;
            }
            this.youImg.hidden = false;
        };
    }

    /**
     * The main deeplearn.js loop
     */
    execute() {
        if (this.videoPlaying) {
            // Get image data from video element
            const image = dl.fromPixels(this.video);

            // Train class if one of the buttons is held down
            if (this.training != -1) {
                // Add current image to classifier
                this.knn.addImage(image, this.training);
            }
            // If any examples have been added
            const exampleCount = this.knn.getClassExampleCount();
            if (Math.max(...exampleCount) > 0) {
                this.knn.predictClass(image)
                .then((res) => {
                    this.currentMove = res.classIndex;
                    for (let i=0; i<NUM_CLASSES; i++) {
                        // Make the predicted class bold
                        if (res.classIndex == i) {
                            this.infoTexts[i].style.fontWeight = 'bold';
                        } else {
                            this.infoTexts[i].style.fontWeight = 'normal';
                        }
                        // Update img if in game
                        if (this.gaming) {
                            this.youImg.hidden = true;
                            if (res.classIndex == i) {
                            this.gestureYouImages[i].hidden = false;
                            } else {
                            this.gestureYouImages[i].hidden = true;
                            }
                        }
                        // Update info text
                        if (exampleCount[i] > 0) {
                            this.infoTexts[i].innerText = 
                            ` ${exampleCount[i]} mẫu - ${res.confidences[i]*100}%`;
                        }
                    }
                    if (!this.firstExampleTrained) {
                        this.firstExampleTrained = true;
                        this.startButton.disabled = false;
                    }
                })
                // Dispose image when done
                .then(()=> image.dispose());
            }
        }
        this.timer = requestAnimationFrame(this.execute.bind(this));
    }
}

window.addEventListener('load', () => new Main());
