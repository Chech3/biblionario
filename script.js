// Audio Controller
const AudioController = {
    ctx: null,
    sounds: {
        intro: new Audio('inicio.mp3'),
        correct: new Audio('success.m4a'),
        wrong: new Audio('error.m4a'),
        timeout: new Audio('error.m4a')
    },

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    play(soundName) {
        if (this.sounds[soundName]) {
            // Start error sounds from 1.0s to skip delay
            if (soundName === 'wrong' || soundName === 'timeout') {
                this.sounds[soundName].currentTime = 1.0;
            } else {
                this.sounds[soundName].currentTime = 0;
            }
            this.sounds[soundName].play().catch(e => console.log("Audio play blocked", e));
        }
    },

    stopAll() {
        Object.values(this.sounds).forEach(s => {
            s.pause();
            s.currentTime = 0;
        });
    },

    // Synthesized Ticking Sound
    playTick() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
};

// Game State
let currentStep = 0;
let currentPrize = 0;
let isAnswered = false;
let sessionQuestions = [];
let timerInterval = null;
let timeLeft = 30;

const prizeLevels = [0, 100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
const safePoints = [0, 5, 10, 15];

// Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const questionText = document.getElementById('question-text');
const optionButtons = document.querySelectorAll('.option-btn');
const prizeDisplay = document.getElementById('current-prize');
const timerDisplay = document.getElementById('timer-display');
const ladderItems = document.querySelectorAll('.ladder-item');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const finalPrizeAmount = document.getElementById('final-prize-amount');

// Modals
const lifelineModal = document.getElementById('lifeline-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close-modal');

// Lifelines
let lifelines = {
    '5050': true,
    'phone': true
};

// Initialization
startBtn.addEventListener('click', () => {
    AudioController.init();
    startGame();
});

restartBtn.addEventListener('click', resetGame);

if (closeModal) {
    closeModal.onclick = () => lifelineModal.style.display = "none";
}

window.onclick = (event) => { 
    if (event.target == lifelineModal) lifelineModal.style.display = "none"; 
};

optionButtons.forEach(button => {
    button.addEventListener('click', () => handleAnswer(parseInt(button.dataset.index)));
});

// Lifeline event listeners
document.getElementById('ll-5050').addEventListener('click', use5050);
document.getElementById('ll-phone').addEventListener('click', usePhone);

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function selectRandomQuestions() {
    const easy = shuffleArray(questions.filter(q => q.level === 1)).slice(0, 5);
    const medium = shuffleArray(questions.filter(q => q.level === 2)).slice(0, 5);
    const hard = shuffleArray(questions.filter(q => q.level === 3)).slice(0, 5);
    
    return [...easy, ...medium, ...hard];
}

function startGame() {
    AudioController.stopAll();
    AudioController.play('intro');
    
    currentStep = 0;
    currentPrize = 0;
    prizeDisplay.textContent = "0";
    
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    sessionQuestions = selectRandomQuestions();
    
    resetLifelines();
    loadQuestion();
}

function loadQuestion() {
    isAnswered = false;
    const q = sessionQuestions[currentStep];
    questionText.textContent = q.question;
    
    optionButtons.forEach((btn, index) => {
        btn.querySelector('.text').textContent = q.options[index];
        btn.classList.remove('selected', 'correct', 'wrong', 'disabled', 'hide');
        btn.style.visibility = 'visible';
    });

    updateLadder();
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 30;
    timerDisplay.textContent = timeLeft;
    timerDisplay.parentElement.classList.remove('timer-low');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        
        // Tick sound
        AudioController.playTick();
        
        if (timeLeft <= 10) {
            timerDisplay.parentElement.classList.add('timer-low');
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timeOut();
        }
    }, 1000);
}

function timeOut() {
    isAnswered = true;
    AudioController.play('wrong');
    const correctIndex = sessionQuestions[currentStep].answer;
    optionButtons[correctIndex].classList.add('correct');
    
    setTimeout(() => {
        showResult(false, "¡Se acabó el tiempo!");
    }, 1000);
}

function handleAnswer(index) {
    if (isAnswered) return;
    isAnswered = true;
    clearInterval(timerInterval);

    const correctIndex = sessionQuestions[currentStep].answer;
    const selectedBtn = optionButtons[index];
    
    selectedBtn.classList.add('selected');

    setTimeout(() => {
        if (index === correctIndex) {
            selectedBtn.classList.add('correct');
            AudioController.play('correct');
            setTimeout(() => {
                currentStep++;
                currentPrize = prizeLevels[currentStep];
                prizeDisplay.textContent = currentPrize.toLocaleString();
                
                if (currentStep >= sessionQuestions.length) {
                    showResult(true);
                } else {
                    loadQuestion();
                }
            }, 1000);
        } else {
            selectedBtn.classList.add('wrong');
            AudioController.play('wrong');
            optionButtons[correctIndex].classList.add('correct');
            setTimeout(() => {
                showResult(false);
            }, 1000);
        }
    }, 800);
}

function updateLadder() {
    ladderItems.forEach(item => {
        item.classList.remove('current');
        if (parseInt(item.dataset.level) === currentStep + 1) {
            item.classList.add('current');
        }
    });
}

function showResult(isWin, customTitle) {
    clearInterval(timerInterval);
    gameScreen.classList.remove('active');
    resultScreen.classList.add('active');

    let finalPrize = 0;
    if (isWin) {
        resultTitle.textContent = "¡ERES BIBLIONARIO!";
        resultMessage.textContent = "Has ganado el gran premio:";
        finalPrize = prizeLevels[prizeLevels.length - 1];
    } else {
        resultTitle.textContent = customTitle || "¡JUEGO TERMINADO!";
        resultMessage.textContent = "Te retiras con:";
        
        let lastSafePoint = 0;
        for (let i = 0; i < safePoints.length; i++) {
            if (currentStep >= safePoints[i]) {
                lastSafePoint = safePoints[i];
            } else {
                break;
            }
        }
        finalPrize = prizeLevels[lastSafePoint];
    }

    finalPrizeAmount.textContent = finalPrize.toLocaleString();
}

function resetGame() {
    resultScreen.classList.remove('active');
    startScreen.classList.add('active');
}

function resetLifelines() {
    lifelines = { '5050': true, 'phone': true };
    document.querySelectorAll('.lifeline-btn').forEach(btn => btn.classList.remove('used'));
}

// Lifeline Logic
function use5050() {
    if (!lifelines['5050'] || isAnswered) return;
    lifelines['5050'] = false;
    document.getElementById('ll-5050').classList.add('used');

    const correctIndex = sessionQuestions[currentStep].answer;
    let removedCount = 0;
    let indices = [0, 1, 2, 3].filter(i => i !== correctIndex);
    
    while (removedCount < 2) {
        const randIdx = Math.floor(Math.random() * indices.length);
        const toHide = indices.splice(randIdx, 1)[0];
        optionButtons[toHide].style.visibility = 'hidden';
        removedCount++;
    }
}

function usePhone() {
    if (!lifelines['phone'] || isAnswered) return;
    lifelines['phone'] = false;
    document.getElementById('ll-phone').classList.add('used');

    const correctIndex = sessionQuestions[currentStep].answer;
    const options = ['A', 'B', 'C', 'D'];
    const certainty = 70 + Math.random() * 25;

    showModal(`<b>📱 Llamada a un amigo:</b><br><br>"Hola, creo que la respuesta correcta es la <b>${options[correctIndex]}</b>. Estoy un ${certainty.toFixed(0)}% seguro de ello."`);
}

function showModal(content) {
    modalBody.innerHTML = content;
    lifelineModal.style.display = "block";
}

