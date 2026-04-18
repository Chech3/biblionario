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
let gameMode = 'solo';
let currentTeamIndex = 0;
let isAnswered = false;
let sessionQuestions = [];
let timerInterval = null;
let timeLeft = 30;

const prizeLevels = [0, 100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
const safePoints = [0, 5, 10, 15];

let teams = [];

// Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const questionText = document.getElementById('question-text');
const optionButtons = document.querySelectorAll('.option-btn');
const timerDisplay = document.getElementById('timer-display');
const ladderItems = document.querySelectorAll('.ladder-item');
const startBtn = document.getElementById('start-btn');
const startBattleBtn = document.getElementById('start-battle-btn');
const restartBtn = document.getElementById('restart-btn');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const finalPrizeAmount = document.getElementById('final-prize-amount');

// Team Elements
const team1Status = document.getElementById('team1-status');
const team2Status = document.getElementById('team2-status');
const team1NameInput = document.getElementById('team1-name');
const team2NameInput = document.getElementById('team2-name');
const turnAnnouncement = document.getElementById('turn-announcement');
const turnTeamNameDisplay = document.getElementById('turn-team-name');

// Modals
const lifelineModal = document.getElementById('lifeline-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close-modal');

// Initialization
startBtn.addEventListener('click', () => initGame('solo'));
startBattleBtn.addEventListener('click', () => initGame('battle'));
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

function initGame(mode) {
    AudioController.init();
    gameMode = mode;
    
    if (mode === 'battle') {
        const name1 = team1NameInput.value.trim() || "Equipo 1";
        const name2 = team2NameInput.value.trim() || "Equipo 2";
        teams = [
            { name: name1, currentStep: 0, lifelines: { '5050': true, 'phone': true }, isEliminated: false, colorClass: 'blue' },
            { name: name2, currentStep: 0, lifelines: { '5050': true, 'phone': true }, isEliminated: false, colorClass: 'orange' }
        ];
        team1Status.querySelector('.team-name').textContent = name1;
        team2Status.querySelector('.team-name').textContent = name2;
        team1Status.style.display = 'flex';
        team2Status.style.display = 'flex';
    } else {
        teams = [{ name: "Jugador", currentStep: 0, lifelines: { '5050': true, 'phone': true }, isEliminated: false, colorClass: 'blue' }];
        team1Status.style.display = 'flex';
        team2Status.style.display = 'none';
        team1Status.querySelector('.team-name').textContent = "PUNTUACIÓN";
    }

    currentTeamIndex = 0;
    sessionQuestions = selectRandomQuestions(); // Note: In battle, we might want more questions or shared ones. For now, shared path.
    
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');
    
    announceTurn();
}

function announceTurn() {
    const team = teams[currentTeamIndex];
    if (gameMode === 'battle') {
        turnAnnouncement.className = `turn-overlay ${team.colorClass}`;
        turnTeamNameDisplay.textContent = team.name.toUpperCase();
        turnAnnouncement.style.display = 'flex';
        
        AudioController.play('intro');
        
        setTimeout(() => {
            turnAnnouncement.style.display = 'none';
            loadQuestion();
        }, 2000);
    } else {
        loadQuestion();
    }
}

function loadQuestion() {
    isAnswered = false;
    const team = teams[currentTeamIndex];
    const q = sessionQuestions[team.currentStep];
    
    questionText.textContent = q.question;
    optionButtons.forEach((btn, index) => {
        btn.querySelector('.text').textContent = q.options[index];
        btn.classList.remove('selected', 'correct', 'wrong', 'disabled', 'hide');
        btn.style.visibility = 'visible';
    });

    updateUI();
    startTimer();
}

function updateUI() {
    const team = teams[currentTeamIndex];
    
    // Update active team highlights
    team1Status.classList.toggle('active', currentTeamIndex === 0);
    team2Status.classList.toggle('active', currentTeamIndex === 1);
    
    // Update scores
    team1Status.querySelector('.team-score').textContent = `$${prizeLevels[teams[0].currentStep].toLocaleString()}`;
    if (teams[1]) {
        team2Status.querySelector('.team-score').textContent = `$${prizeLevels[teams[1].currentStep].toLocaleString()}`;
    }

    // Update Ladder
    ladderItems.forEach(item => {
        item.classList.remove('current');
        if (parseInt(item.dataset.level) === team.currentStep + 1) {
            item.classList.add('current');
        }
    });

    // Update Lifelines
    updateLifelineButtons();
}

function updateLifelineButtons() {
    const team = teams[currentTeamIndex];
    document.getElementById('ll-5050').classList.toggle('used', !team.lifelines['5050']);
    document.getElementById('ll-phone').classList.toggle('used', !team.lifelines['phone']);
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 30;
    timerDisplay.textContent = timeLeft;
    timerDisplay.parentElement.classList.remove('timer-low');
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        AudioController.playTick();
        
        if (timeLeft <= 10) timerDisplay.parentElement.classList.add('timer-low');
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleAnswer(-1); // Timeout
        }
    }, 1000);
}

function handleAnswer(index) {
    if (isAnswered) return;
    isAnswered = true;
    clearInterval(timerInterval);

    const team = teams[currentTeamIndex];
    const correctIndex = sessionQuestions[team.currentStep].answer;
    
    if (index !== -1) {
        optionButtons[index].classList.add('selected');
    }

    setTimeout(() => {
        if (index === correctIndex) {
            optionButtons[correctIndex].classList.add('correct');
            AudioController.play('correct');
            
            setTimeout(() => {
                team.currentStep++;
                if (team.currentStep >= 15) {
                    team.isEliminated = true; // Reached the top!
                    checkGameOver();
                } else {
                    switchTurn();
                }
            }, 1500);
        } else {
            if (index !== -1) optionButtons[index].classList.add('wrong');
            optionButtons[correctIndex].classList.add('correct');
            AudioController.play('wrong');
            
            team.isEliminated = true;
            
            setTimeout(() => {
                switchTurn();
            }, 2000);
        }
    }, 1000);
}

function switchTurn() {
    if (gameMode === 'solo') {
        if (teams[0].isEliminated) {
            showResult();
        } else {
            loadQuestion();
        }
        return;
    }

    // Battle Mode Switch
    const otherIndex = (currentTeamIndex + 1) % 2;
    
    if (!teams[otherIndex].isEliminated) {
        currentTeamIndex = otherIndex;
        announceTurn();
    } else if (!teams[currentTeamIndex].isEliminated) {
        // Continue with current team if other is eliminated
        loadQuestion();
    } else {
        showResult();
    }
}

function checkGameOver() {
    const allFinished = teams.every(t => t.isEliminated || t.currentStep >= 15);
    if (allFinished) showResult();
}

function showResult() {
    gameScreen.classList.remove('active');
    resultScreen.classList.add('active');

    if (gameMode === 'battle') {
        const s1 = getSafePrize(teams[0].currentStep);
        const s2 = getSafePrize(teams[1].currentStep);
        
        if (s1 > s2) {
            resultTitle.textContent = `¡GANÓ ${teams[0].name.toUpperCase()}!`;
        } else if (s2 > s1) {
            resultTitle.textContent = `¡GANÓ ${teams[1].name.toUpperCase()}!`;
        } else {
            resultTitle.textContent = "¡EMPATE TÉCNICO!";
        }
        
        resultMessage.textContent = `${teams[0].name}: $${s1.toLocaleString()} | ${teams[1].name}: $${s2.toLocaleString()}`;
        finalPrizeAmount.textContent = Math.max(s1, s2).toLocaleString();
    } else {
        const prize = getSafePrize(teams[0].currentStep);
        resultTitle.textContent = teams[0].currentStep >= 15 ? "¡ERES BIBLIONARIO!" : "JUEGO TERMINADO";
        resultMessage.textContent = "Te retiras con:";
        finalPrizeAmount.textContent = prize.toLocaleString();
    }
}

function getSafePrize(step) {
    if (step >= 15) return prizeLevels[15];
    let lastSafe = 0;
    for (const s of safePoints) {
        if (step >= s) lastSafe = s;
    }
    return prizeLevels[lastSafe];
}

function resetGame() {
    resultScreen.classList.remove('active');
    startScreen.classList.add('active');
}

// Lifelines
function use5050() {
    const team = teams[currentTeamIndex];
    if (!team.lifelines['5050'] || isAnswered) return;
    team.lifelines['5050'] = false;
    updateLifelineButtons();

    const correctIndex = sessionQuestions[team.currentStep].answer;
    let indices = [0, 1, 2, 3].filter(i => i !== correctIndex);
    shuffleArray(indices);
    optionButtons[indices[0]].style.visibility = 'hidden';
    optionButtons[indices[1]].style.visibility = 'hidden';
}

function usePhone() {
    const team = teams[currentTeamIndex];
    if (!team.lifelines['phone'] || isAnswered) return;
    team.lifelines['phone'] = false;
    updateLifelineButtons();

    const correctIndex = sessionQuestions[team.currentStep].answer;
    const options = ['A', 'B', 'C', 'D'];
    const certainty = 70 + Math.random() * 25;
    showModal(`<b>📱 Llamada a un amigo:</b><br><br>"Hola ${team.name}, creo que la respuesta es la <b>${options[correctIndex]}</b>. Estoy un ${certainty.toFixed(0)}% seguro."`);
}

function showModal(content) {
    modalBody.innerHTML = content;
    lifelineModal.style.display = "block";
}
