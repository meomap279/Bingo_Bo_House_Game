// app.js - Main Application Logic

// --- 0. Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBK5F_J8BUK2910FLgd8eEeExi5yiLkd-8",
    authDomain: "bingo-bo-house-game-app.firebaseapp.com",
    // URL đã được cập nhật theo đúng khu vực của database (asia-southeast1)
    databaseURL: "https://bingo-bo-house-game-app-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "bingo-bo-house-game-app",
    storageBucket: "bingo-bo-house-game-app.appspot.com",
    messagingSenderId: "191092820571",
    appId: "1:191092820571:web:3fe27176ed42bc67a0cd7e"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
const storage = firebase.storage();

// --- 1. State Management ---
const gameState = {
    user: null, // Will hold Firebase user object { uid, email, displayName }
    playerId: null, // Will be set to user.uid after login
    roomCode: null, // Mã phòng hiện tại
    currentTurnPlayerId: null, // ID của người chơi đang có lượt
    knownPlayerIds: new Set(), // Players we already know about in the current room
    playerRole: null, // 'host' hoặc 'guest'
    bingoBoard: Array(25).fill(null), // Stores numbers 1-25
    selectedCells: Array(25).fill(false), // True if cell is marked
    calledNumbers: new Set(), // Numbers already called by the host
    isBoardLocked: false,
    linesCompleted: new Set(), // Stores indices of completed lines (0-11)
    totalLinesCompleted: 0,
    roomStatus: null, // 'waiting', 'playing', 'finished'
    isGameOver: false,
    isMuted: false,
    theme: 'cyan', // Default theme
};

// --- 2. Constants & DOM Elements ---
const BINGO_SIZE = 5;
const TOTAL_CELLS = BINGO_SIZE * BINGO_SIZE;
const MIN_NUMBER = 1;
const MAX_NUMBER = 25;
const TURN_DURATION = 15; // 15 seconds
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2UwZTBlMCI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2MxLjY2IDAgMyAxLjM0IDMgM3MtMS4zNCAzLTMgMy0zLTEuMzQtMy0zIDEuMzQtMyAzLTN6bTAgMTRjLTIuNjcgMC01LTEuMjgtNi42Ny0zLjIyLjI1LS45OCAyLjUyLTEuNzggNC4xNy0yLjE0QzEwLjUgMTMuOCAxMS4yMyAxNCAxMiAxNHMxLjUtLjIgMi41LS41N2MxLjY1LjM2IDMuOTIgMS4xNiA0LjE3IDIuMTRDMTcgMTcuNzIgMTQuNjcgMTkgMTIgMTl6Ii8+PC9wYXRoPjwvc3ZnPg==';

const DOMElements = {
    // Main Modal & Views
    mainModal: document.getElementById('main-modal'),
    authView: document.getElementById('auth-view'),
    lobbyView: document.getElementById('lobby-view'),
    // Auth Form
    authForm: document.getElementById('auth-form'),
    authTitle: document.getElementById('auth-title'),
    authUsernameInput: document.getElementById('auth-username'),
    authEmailInput: document.getElementById('auth-email'),
    authPasswordInput: document.getElementById('auth-password'),
    authError: document.getElementById('auth-error'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    authToggleText: document.getElementById('auth-toggle-text'),
    authSubmitBtnText: document.getElementById('auth-submit-btn-text'),
    authSubmitBtnLoading: document.getElementById('auth-submit-btn-loading'),
    authSuccess: document.getElementById('auth-success'),
    // Lobby
    createRoomBtn: document.getElementById('create-room-btn'),
    joinRoomBtn: document.getElementById('join-room-btn'),
    roomCodeInput: document.getElementById('room-code-input'),
    maxPlayersSelect: document.getElementById('max-players-select'),
    roomActions: document.getElementById('room-actions'),
    roomInfoDisplay: document.getElementById('room-info-display'),
    waitingForPlayerText: document.getElementById('waiting-for-player-text') || document.createElement('span'),
    lobbyPlayerListContainer: document.getElementById('lobby-player-list-container'),
    lobbyPlayerList: document.getElementById('lobby-player-list'),
    startGameBtn: document.getElementById('start-game-btn'),
    roomCodeDisplay: document.getElementById('room-code-display'),
    leaveRoomBtn: document.getElementById('leave-room-btn'),
    // In-Game Info
    gameRoomInfo: document.getElementById('game-room-info'),
    gameRoomCode: document.getElementById('game-room-code'),
    playerListContainer: document.getElementById('player-list-container'),
    turnStatusDisplay: document.getElementById('turn-status-display'),
    turnStatusText: document.getElementById('turn-status-text'),
    turnTimerContainer: document.getElementById('turn-timer-container'),
    turnTimerBar: document.getElementById('turn-timer-bar'),
    playerList: document.getElementById('player-list'),
    // Profile Modal
    profileModal: document.getElementById('profile-modal'),
    closeProfileModalBtn: document.getElementById('close-profile-modal-btn'),
    profileAvatarPreview: document.getElementById('profile-avatar-preview'),
    avatarUploadInput: document.getElementById('avatar-upload-input'),
    profileUploadStatus: document.getElementById('profile-upload-status'),
    // Game elements
    bingoGrid: document.getElementById('bingo-grid'),
    boardControls: document.getElementById('board-controls'),
    newGameBtn: document.getElementById('new-game-btn'),
    randomFillBtn: document.getElementById('random-fill-btn'),
    lockBoardBtn: document.getElementById('lock-board-btn'),
    currentCalledNumber: document.getElementById('current-called-number'),
    calledNumberSphere: document.getElementById('called-number-sphere'),
    calledCount: document.getElementById('called-count'),
    calledNumbersHistory: document.getElementById('called-numbers-history'),
    linesCompletedCount: document.getElementById('lines-completed-count'),
    bingoLinesSVG: document.getElementById('bingo-lines-svg'),
    victoryModal: document.getElementById('victory-modal'),
    gameOverTitle: document.getElementById('game-over-title'),
    gameOverMessage: document.getElementById('game-over-message'),
    resetGameBtn: document.getElementById('reset-game-btn'),
    toggleSoundBtn: document.getElementById('toggle-sound-btn'),
    themeSelector: document.querySelector('.theme-selector'),
    linesCompletedCountText: document.getElementById('lines-completed-count-text'),
    linesProgressBar: document.getElementById('lines-progress-bar'),
    gameContainer: document.getElementById('game-container'),
    // User display
    userProfileContainer: document.getElementById('user-profile-container'),
    userAvatar: document.getElementById('user-avatar'),
    userInfo: document.getElementById('user-info'),
    userDisplayName: document.getElementById('user-display-name'),
    userDropdown: document.getElementById('user-dropdown'),
    viewProfileLink: document.getElementById('view-profile-link'),
    logoutBtn: document.getElementById('logout-btn'),
};

// Define the 12 winning lines (indices of cells 0-24)
// Rows (0-4), Columns (5-9), Diagonals (10-11)
const WINNING_LINES = [
    // Rows
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    // Columns
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    // Diagonals
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20]
];

const THEMES = {
    cyan: {
        '--theme-primary': '#00f2fe',
        '--theme-secondary': '#9d4edd',
        '--theme-accent': '#ffb703',
    },
    purple: {
        '--theme-primary': '#9d4edd',
        '--theme-secondary': '#00f2fe',
        '--theme-accent': '#ffb703',
    },
    amber: {
        '--theme-primary': '#ffb703',
        '--theme-secondary': '#9d4edd',
        '--theme-accent': '#00f2fe',
    },
};

let isRegisterMode = false;
let turnTimerInterval;

function applyTheme(themeName) {
    const theme = THEMES[themeName] || THEMES.cyan;
    Object.entries(theme).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
    });
    gameState.theme = themeName;
}

// --- 3. Web Audio API Synth Module ---
class AudioManager {
    constructor() {
        this.audioContext = new(window.AudioContext || window.webkitAudioContext)();
        this.gainNode = this.audioContext.createGain();
        this.masterVolume = 0.3;
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.value = this.masterVolume;
    }

    // Method to mute/unmute all sounds
    setMute(isMuted) {
        const now = this.audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        const targetVolume = isMuted ? 0 : this.masterVolume;
        this.gainNode.gain.linearRampToValueAtTime(targetVolume, now + 0.01);
    }

    // Helper to create and play a simple tone
    _playTone(frequency, duration, type = 'sine', attack = 0.01, decay = 0.1, sustain = 0.5, release = 0.1, startTime = this.audioContext.currentTime) {
        const oscillator = this.audioContext.createOscillator();
        const envelope = this.audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startTime);

        envelope.gain.setValueAtTime(0, startTime);
        envelope.gain.linearRampToValueAtTime(1, startTime + attack);
        envelope.gain.linearRampToValueAtTime(sustain, startTime + attack + decay);
        envelope.gain.linearRampToValueAtTime(0, startTime + duration - release);

        oscillator.connect(envelope);
        envelope.connect(this.gainNode);
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }

    playPopSound() {
        this._playTone(880, 0.1, 'sine', 0.005, 0.05, 0.8, 0.05);
        this._playTone(1320, 0.1, 'sine', 0.005, 0.05, 0.6, 0.05);
    }

    playLaserSound() {
        const startTime = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, startTime + 0.3);
        oscillator.frequency.exponentialRampToValueAtTime(200, startTime + 0.6);

        gain.gain.setValueAtTime(0.5, startTime);
        gain.gain.linearRampToValueAtTime(0.1, startTime + 0.6);
        gain.gain.linearRampToValueAtTime(0, startTime + 0.7);

        oscillator.connect(gain);
        gain.connect(this.gainNode);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.7);
    }

    playVictoryFanfare() {
        const now = this.audioContext.currentTime;
        const quarter = 0.25;

        // C Major Chord (C4, E4, G4)
        this._playTone(261.63, quarter * 2, 'triangle', 0.05, 0.1, 0.7, 0.2);
        this._playTone(329.63, quarter * 2, 'triangle', 0.05, 0.1, 0.7, 0.2);
        this._playTone(392.00, quarter * 2, 'triangle', 0.05, 0.1, 0.7, 0.2);

        // G Major Chord (G4, B4, D5)
        this._playTone(392.00, quarter * 2, 'triangle', 0.05, 0.1, 0.7, 0.2, now + quarter * 2);
        this._playTone(493.88, quarter * 2, 'triangle', 0.05, 0.1, 0.7, 0.2, now + quarter * 2);
        this._playTone(587.33, quarter * 2, 'triangle', 0.05, 0.1, 0.7, 0.2, now + quarter * 2);

        // C Major Chord (C5, E5, G5)
        this._playTone(523.25, quarter * 4, 'triangle', 0.05, 0.1, 0.7, 0.5, now + quarter * 4);
        this._playTone(659.25, quarter * 4, 'triangle', 0.05, 0.1, 0.7, 0.5, now + quarter * 4);
        this._playTone(783.99, quarter * 4, 'triangle', 0.05, 0.1, 0.7, 0.5, now + quarter * 4);
    }
}

const audioManager = new AudioManager();

// --- 4. Utility Functions ---
const STORAGE_KEY = 'bingoGameState';

function saveState() {
    try {
        const stateToSave = {
            ...gameState,
            calledNumbers: Array.from(gameState.calledNumbers),
            linesCompleted: Array.from(gameState.linesCompleted),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
        console.error("Failed to save game state:", e);
    }
}

function loadState() {
    try {
        const savedStateJSON = localStorage.getItem(STORAGE_KEY);
        if (!savedStateJSON) return null;

        const savedState = JSON.parse(savedStateJSON);
        return {
            ...savedState,
            calledNumbers: new Set(savedState.calledNumbers),
            linesCompleted: new Set(savedState.linesCompleted),
        };
    } catch (e) {
        console.error("Failed to load game state:", e);
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

// Fisher-Yates (Knuth) Shuffle
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Ripple effect for buttons
function applyRippleEffect(event) {
    const button = event.currentTarget;
    button.classList.add('animate');
    setTimeout(() => {
        button.classList.remove('animate');
    }, 700);
}

// --- 5. UI Rendering & Updates ---
function renderBingoGrid() {
    DOMElements.bingoGrid.innerHTML = '';
    for (let i = 0; i < TOTAL_CELLS; i++) {
        const cell = document.createElement('div');
        cell.classList.add('bingo-cell');
        cell.dataset.index = i;

        const input = document.createElement('input');
        input.type = 'number';
        input.min = MIN_NUMBER;
        input.max = MAX_NUMBER;
        input.value = gameState.bingoBoard[i] || '';
        input.maxLength = 2;
        input.readOnly = gameState.isBoardLocked;

        if (gameState.isBoardLocked) {
            cell.classList.add('locked');
        }
        if (gameState.selectedCells[i]) {
            cell.classList.add('selected');
        }

        cell.appendChild(input);
        DOMElements.bingoGrid.appendChild(cell);
    }
    addGridEventListeners();
}

function updateCallerDisplay() {
    DOMElements.currentCalledNumber.textContent = gameState.calledNumbers.size > 0 ? Array.from(gameState.calledNumbers).pop() : '?';
    DOMElements.calledCount.textContent = gameState.calledNumbers.size;

    DOMElements.calledNumbersHistory.innerHTML = '';
    Array.from(gameState.calledNumbers).sort((a, b) => a - b).forEach(num => {
        const chip = document.createElement('span');
        chip.classList.add('history-chip');
        chip.textContent = num;
        DOMElements.calledNumbersHistory.appendChild(chip);
    });
    DOMElements.calledNumbersHistory.scrollTop = DOMElements.calledNumbersHistory.scrollHeight;

    DOMElements.calledNumberSphere.classList.remove('pop-bounce');
    void DOMElements.calledNumberSphere.offsetWidth;
    DOMElements.calledNumberSphere.classList.add('pop-bounce');
}

function updateSoundButtonUI() {
    DOMElements.toggleSoundBtn.textContent = gameState.isMuted ? '🔇' : '🔊';
}

function updateLinesCompletedDisplay() {
    const maxLines = WINNING_LINES.length;
    DOMElements.linesCompletedCountText.textContent = gameState.totalLinesCompleted;
    const progressPercentage = (gameState.totalLinesCompleted / maxLines) * 100;
    DOMElements.linesProgressBar.style.width = `${progressPercentage}%`;
}

function triggerConfetti() {
    if (typeof confetti !== 'function') return;
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
            return clearInterval(interval);
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

function showVictoryModal(isWinner = true, winnerName = '') {
    if (isWinner) {
        DOMElements.gameOverTitle.textContent = '🏆 BINGO! VICTORY! 🏆';
        DOMElements.gameOverMessage.textContent = 'Chúc mừng bạn đã hoàn thành 5 đường BINGO!';
        audioManager.playVictoryFanfare();
        triggerConfetti();
    } else {
        DOMElements.gameOverTitle.textContent = 'GAME OVER';
        DOMElements.gameOverMessage.textContent = `Rất tiếc! ${winnerName} đã chiến thắng.`;
    }

    // Cập nhật nút bấm dựa trên vai trò của người chơi
    if (gameState.playerRole === 'host') {
        DOMElements.resetGameBtn.querySelector('.button-text').textContent = '🔄 Chơi Ván Mới';
    } else {
        DOMElements.resetGameBtn.querySelector('.button-text').textContent = 'OK';
    }

    DOMElements.victoryModal.classList.add('visible');
}

function hideVictoryModal() {
    DOMElements.victoryModal.classList.remove('visible');
}

function showMultiplayerModal() {
    DOMElements.mainModal.classList.add('visible');
    DOMElements.gameContainer.classList.add('hidden');
}

function hideMultiplayerModal() {
    DOMElements.mainModal.classList.remove('visible');
    DOMElements.gameContainer.classList.remove('hidden');
}

function openProfileModal() {
    DOMElements.profileAvatarPreview.src = (gameState.user && gameState.user.photoURL) || DEFAULT_AVATAR;
    DOMElements.profileModal.classList.add('visible');
}

function closeProfileModal() {
    DOMElements.profileModal.classList.remove('visible');
}

function resetClientForNewRound() {
    // Don't touch: user, playerId, roomCode, playerRole, knownPlayerIds, roomStatus
    gameState.bingoBoard.fill(null);
    gameState.selectedCells.fill(false);
    gameState.calledNumbers.clear();
    gameState.isBoardLocked = false;
    gameState.linesCompleted.clear();
    gameState.totalLinesCompleted = 0;
    gameState.isGameOver = false;

    // Reset UI
    renderBingoGrid();
    updateCallerDisplay();
    updateLinesCompletedDisplay();
    hideVictoryModal();
    DOMElements.bingoLinesSVG.innerHTML = '';
    DOMElements.bingoGrid.classList.remove('bingo-victory');
    DOMElements.randomFillBtn.disabled = false;
    DOMElements.lockBoardBtn.disabled = false;
    DOMElements.lockBoardBtn.querySelector('.button-text').textContent = '🔒 Khóa Bảng & Bắt Đầu';
    DOMElements.currentCalledNumber.textContent = '?';
    DOMElements.boardControls.classList.remove('hidden');
    DOMElements.turnStatusDisplay.classList.add('hidden');
    clearInterval(turnTimerInterval);

    showMultiplayerModal();
}
// --- 6. Game Logic ---
function displayAuthError(message) {
    DOMElements.authError.textContent = "Lỗi: " + message;
    DOMElements.authError.classList.remove('hidden');
    DOMElements.authError.classList.add('animate-shake');
}

function displayAuthSuccess(message) {
    DOMElements.authSuccess.textContent = message;
    DOMElements.authSuccess.classList.remove('hidden');
    DOMElements.authSuccess.classList.add('animate-fade-in');
    setTimeout(() => DOMElements.authSuccess.classList.add('hidden'), 3000);
}

function initializeGame(forceReset = false) {
    localStorage.removeItem(STORAGE_KEY);
    gameState.playerId = gameState.user ? gameState.user.uid : null;

    gameState.bingoBoard.fill(null);
    gameState.selectedCells.fill(false);
    gameState.calledNumbers.clear();
    gameState.isBoardLocked = false;
    gameState.linesCompleted.clear();
    gameState.totalLinesCompleted = 0;
    gameState.isGameOver = false;
    gameState.roomCode = null;
    gameState.playerRole = null;
    gameState.knownPlayerIds.clear();

    if (gameState.user) {
        DOMElements.authView.classList.add('hidden');
        DOMElements.lobbyView.classList.remove('hidden');
    } else {
        DOMElements.authView.classList.remove('hidden');
        DOMElements.lobbyView.classList.add('hidden');
    }
    DOMElements.roomActions.classList.remove('hidden');
    DOMElements.roomInfoDisplay.classList.add('hidden');
    renderBingoGrid();
    DOMElements.startGameBtn.classList.add('hidden');
    DOMElements.startGameBtn.disabled = true;
    updateCallerDisplay();
    updateLinesCompletedDisplay();
    hideVictoryModal();
    DOMElements.bingoLinesSVG.innerHTML = '';
    DOMElements.bingoGrid.classList.remove('bingo-victory');

    applyTheme(gameState.theme);
    updateSoundButtonUI();

    DOMElements.randomFillBtn.disabled = false;
    DOMElements.lockBoardBtn.disabled = false;
    DOMElements.currentCalledNumber.textContent = '?';
    DOMElements.lockBoardBtn.querySelector('.button-text').textContent = '🔒 Khóa Bảng & Bắt Đầu';
    DOMElements.roomCodeInput.value = '';
}

function fillBoardRandomly() {
    if (gameState.isBoardLocked) return;

    const numbers = Array.from({ length: MAX_NUMBER }, (_, i) => i + MIN_NUMBER);
    shuffleArray(numbers);
    gameState.bingoBoard = numbers.slice(0, TOTAL_CELLS);
    renderBingoGrid();
}

async function createRoom() {
    DOMElements.createRoomBtn.disabled = true;
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    gameState.roomCode = roomCode;
    gameState.playerRole = 'host';
    const maxPlayers = parseInt(DOMElements.maxPlayersSelect.value, 10);

    const roomData = {
        status: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        hostId: gameState.playerId,
        playerOrder: [],
        maxPlayers: maxPlayers,
        turn: null,
        turnStartedAt: null,
        players: {
            [gameState.playerId]: {
                role: 'host',
                isReady: false,
                displayName: gameState.user.displayName,
                photoURL: gameState.user.photoURL || null,
                disconnectedAt: null,
            }
        },
        calledNumbers: {},
    };

    try {
        await database.ref('rooms/' + roomCode).set(roomData);
        console.log(`Room ${roomCode} created successfully.`);

        const playerRef = database.ref(`rooms/${roomCode}/players/${gameState.playerId}`);
        playerRef.onDisconnect().update({ disconnectedAt: firebase.database.ServerValue.TIMESTAMP });
        localStorage.setItem('activeRoomCode', roomCode);

        DOMElements.roomActions.classList.add('hidden');
        DOMElements.roomInfoDisplay.classList.remove('hidden');
        DOMElements.roomCodeDisplay.textContent = roomCode;

        listenForGameEvents(roomCode);
    } catch (error) {
        console.error("Failed to create room:", error);
        alert("Không thể tạo phòng. Vui lòng thử lại.");
        DOMElements.createRoomBtn.disabled = false;
    }
}

async function joinRoom() {
    const roomCode = DOMElements.roomCodeInput.value.trim().toUpperCase();
    if (roomCode.length !== 5) {
        alert("Mã phòng phải có 5 ký tự.");
        return;
    }

    DOMElements.joinRoomBtn.disabled = true;
    const roomRef = database.ref('rooms/' + roomCode);
    const snapshot = await roomRef.once('value');

    if (!snapshot.exists()) {
        alert("Phòng không tồn tại!");
        DOMElements.joinRoomBtn.disabled = false;
        return;
    }

    const roomData = snapshot.val();
    const maxPlayers = roomData.maxPlayers || 2;
    if (Object.keys(roomData.players || {}).length >= maxPlayers) {
        alert("Phòng đã đầy!");
        DOMElements.joinRoomBtn.disabled = false;
        return;
    }

    try {
        gameState.roomCode = roomCode;
        gameState.playerRole = 'guest';
        await roomRef.child('players').child(gameState.playerId).set({
            role: 'guest',
            isReady: false,
            displayName: gameState.user.displayName,
            photoURL: gameState.user.photoURL || null,
            disconnectedAt: null,
        });
        console.log(`Joined room ${roomCode} as a guest.`);
        alert("Bạn đã vào phòng! Hãy khóa bảng của bạn để bắt đầu.");

        DOMElements.roomActions.classList.add('hidden');
        DOMElements.roomInfoDisplay.classList.remove('hidden');
        DOMElements.roomCodeDisplay.textContent = roomCode;

        const playerRef = database.ref(`rooms/${roomCode}/players/${gameState.playerId}`);
        playerRef.onDisconnect().update({ disconnectedAt: firebase.database.ServerValue.TIMESTAMP });
        localStorage.setItem('activeRoomCode', roomCode);

        listenForGameEvents(roomCode);
    } catch (error) {
        console.error("Failed to join room:", error);
        alert("Không thể vào phòng. Vui lòng thử lại.");
        DOMElements.joinRoomBtn.disabled = false;
    }
}

async function handleLeaveRoom() {
    if (!gameState.roomCode || !gameState.playerId) return;

    const roomCode = gameState.roomCode;
    const playerId = gameState.playerId;
    const roomRef = database.ref(`rooms/${roomCode}`);
    const playerRef = roomRef.child('players').child(playerId);

    try {
        await playerRef.onDisconnect().cancel();
        await playerRef.remove();

        const roomSnapshot = await roomRef.once('value');
        const roomData = roomSnapshot.val();
        if (roomData && (!roomData.players || Object.keys(roomData.players).length === 0)) {
            console.log(`Room ${roomCode} is empty, deleting it.`);
            await roomRef.remove();
        }
    } catch (error) {
        console.error("Error during Firebase cleanup on leave:", error);
    } finally {
        cleanUpAfterLeave(roomCode);
    }
}

function cleanUpAfterLeave(roomCode) {
    if (roomCode) {
        database.ref('rooms/' + roomCode).off();
    }
    localStorage.removeItem('activeRoomCode');
    initializeGame(true);
    showMultiplayerModal();
}

async function rejoinRoom(roomCode) {
    const roomRef = database.ref('rooms/' + roomCode);
    const snapshot = await roomRef.once('value');

    if (snapshot.exists()) {
        const roomData = snapshot.val();
        const playerInRoom = roomData.players && roomData.players[gameState.playerId];

        if (playerInRoom) {
            console.log("Successfully reconnected to room", roomCode);
            gameState.roomCode = roomCode;
            gameState.playerRole = playerInRoom.role;

            const playerRef = database.ref(`rooms/${roomCode}/players/${gameState.playerId}`);
            playerRef.onDisconnect().update({ disconnectedAt: firebase.database.ServerValue.TIMESTAMP });
            await playerRef.update({ disconnectedAt: null });

            listenForGameEvents(roomCode);
            hideMultiplayerModal();
        } else {
            cleanUpAfterLeave(roomCode);
        }
    } else {
        cleanUpAfterLeave(roomCode);
    }
}

function renderPlayerList(players) {
    DOMElements.playerList.innerHTML = '';
    if (!players) return;

    Object.values(players).forEach(player => {
        const playerEl = document.createElement('div');
        playerEl.className = 'player-item';
        if (player.role === 'host') {
            playerEl.classList.add('is-host');
        }
        if (player.disconnectedAt) {
            playerEl.classList.add('is-offline');
        }

        const avatar = player.photoURL || DEFAULT_AVATAR;
        const displayName = player.displayName || 'Player';

        playerEl.innerHTML = `
            <img src="${avatar}" alt="Avatar" class="header-avatar">
            <span class="player-name">${displayName}</span>
            ${player.role === 'host' ? '<span class="host-icon" title="Chủ phòng">👑</span>' : ''}
            <span class="player-status ${player.isReady ? 'is-ready' : ''}" title="${player.isReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}"></span>
        `;

        DOMElements.playerList.appendChild(playerEl);
    });
}

function renderLobbyPlayerList(players) {
    DOMElements.lobbyPlayerList.innerHTML = '';
    if (!players) return;

    Object.values(players).forEach(player => {
        const playerEl = document.createElement('div');
        playerEl.className = 'player-item';
        if (player.role === 'host') {
            playerEl.classList.add('is-host');
        }

        const avatar = player.photoURL || DEFAULT_AVATAR;
        const displayName = player.displayName || 'Player';

        playerEl.innerHTML = `
            <img src="${avatar}" alt="Avatar" class="header-avatar">
            <span class="player-name">${displayName}</span>
            ${player.role === 'host' ? '<span class="host-icon" title="Chủ phòng">👑</span>' : ''}
            <span class="player-status ${player.isReady ? 'is-ready' : ''}" title="${player.isReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}"></span>
        `;
        DOMElements.lobbyPlayerList.appendChild(playerEl);
    });
}

async function skipTurn() {
    if (!gameState.roomCode || gameState.playerRole !== 'host') return;

    const roomRef = database.ref('rooms/' + gameState.roomCode);
    roomRef.transaction(roomData => {
        if (roomData && roomData.status === 'playing') {
            const now = Date.now();
            if (now - roomData.turnStartedAt < TURN_DURATION * 1000) {
                console.log("Host tried to skip turn, but it was updated recently. Aborting skip.");
                return;
            }

            const playerOrder = roomData.playerOrder;
            const currentPlayerIndex = playerOrder.indexOf(roomData.turn);
            const nextPlayerIndex = (currentPlayerIndex + 1) % playerOrder.length;
            const nextPlayerId = playerOrder[nextPlayerIndex];

            roomData.turn = nextPlayerId;
            roomData.turnStartedAt = firebase.database.ServerValue.TIMESTAMP;
            return roomData;
        }
        return;
    }, (error, committed) => {
        if (error) {
            console.error('Skip turn transaction failed:', error);
        } else if (!committed) {
            console.log('Skip turn transaction aborted (e.g., player made a move).');
        } else {
            console.log('Skip turn transaction succeeded.');
        }
    });
}

function updateTurnUI(roomData) {
    const players = roomData.players || {};

    // --- Xử lý các trạng thái không phải là 'playing' ---
    if (roomData.status !== 'playing') {
        DOMElements.turnStatusDisplay.classList.add('hidden');
        DOMElements.bingoGrid.classList.remove('is-my-turn');
        // Hiển thị tất cả các nút điều khiển bảng khi không ở trong trận
        DOMElements.boardControls.classList.remove('hidden');
        DOMElements.randomFillBtn.disabled = gameState.isBoardLocked;
        DOMElements.lockBoardBtn.disabled = gameState.isBoardLocked;
        DOMElements.newGameBtn.classList.remove('hidden');
        return;
    }

    // --- Xử lý trạng thái 'playing' ---
    DOMElements.turnStatusDisplay.classList.remove('hidden');
    DOMElements.newGameBtn.classList.add('hidden'); // Nút "Trò Chơi Mới" bị ẩn trong trận
    clearInterval(turnTimerInterval);

    // Nếu người chơi cục bộ chưa khóa bảng
    if (!gameState.isBoardLocked) {
        DOMElements.boardControls.classList.remove('hidden');
        DOMElements.randomFillBtn.disabled = false;
        DOMElements.lockBoardBtn.disabled = false;
        DOMElements.turnStatusText.textContent = 'Hãy điền và khóa bảng của bạn để sẵn sàng!';
        DOMElements.turnTimerContainer.classList.add('hidden');
        DOMElements.bingoGrid.classList.remove('is-my-turn');
        return;
    }

    // Nếu người chơi cục bộ đã khóa bảng, ẩn các nút điều khiển và hiển thị trạng thái
    DOMElements.boardControls.classList.add('hidden');

    const allPlayersReady = Object.values(players).every(p => p.isReady === true);

    // Nếu đang chờ những người chơi khác sẵn sàng
    if (!allPlayersReady) {
        DOMElements.turnStatusText.textContent = 'Đang chờ các người chơi khác khóa bảng...';
        DOMElements.turnTimerContainer.classList.add('hidden');
        DOMElements.bingoGrid.classList.remove('is-my-turn');
        return;
    }

    // --- Tất cả người chơi đã sẵn sàng, logic lượt chơi bắt đầu ---

    // Nếu lượt chơi chưa được thiết lập, chủ phòng sẽ thiết lập
    if (!roomData.turn) {
        if (gameState.playerRole === 'host') {
            const roomRef = database.ref('rooms/' + gameState.roomCode);
            roomRef.update({
                turn: roomData.playerOrder[0],
                turnStartedAt: firebase.database.ServerValue.TIMESTAMP
            });
        }
        // Khách chỉ cần đợi lượt được thiết lập
        DOMElements.turnStatusText.textContent = 'Tất cả đã sẵn sàng! Chuẩn bị bắt đầu...';
        DOMElements.bingoGrid.classList.remove('is-my-turn');
        return;
    }

    // Lượt chơi đã được thiết lập, tiến hành với thanh thời gian và UI
    if (roomData.turnStartedAt) {
        DOMElements.turnTimerContainer.classList.remove('hidden');
        const turnStartTime = roomData.turnStartedAt;

        turnTimerInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - turnStartTime) / 1000;
            const remaining = Math.max(0, TURN_DURATION - elapsed);
            const percentage = (remaining / TURN_DURATION) * 100;
            DOMElements.turnTimerBar.style.width = `${percentage}%`;

            if (remaining <= 0 && gameState.playerRole === 'host') {
                clearInterval(turnTimerInterval);
                skipTurn();
            }
        }, 500);
    } else {
        DOMElements.turnTimerContainer.classList.add('hidden');
    }

    const currentTurnPlayerId = roomData.turn;
    gameState.currentTurnPlayerId = currentTurnPlayerId;

    if (currentTurnPlayerId === gameState.playerId) {
        DOMElements.turnStatusText.textContent = '✨ Đến lượt bạn chọn một số! ✨';
        DOMElements.bingoGrid.classList.add('is-my-turn');
    } else {
        const currentPlayer = roomData.players[currentTurnPlayerId];
        const currentTurnPlayerName = currentPlayer ? currentPlayer.displayName : 'Đối thủ';
        DOMElements.turnStatusText.textContent = `⏳ Đang chờ ${currentTurnPlayerName} chọn...`;
        DOMElements.bingoGrid.classList.remove('is-my-turn');
    }
}

function listenForGameEvents(roomCode) {
    const roomRef = database.ref('rooms/' + roomCode);
    roomRef.on('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) {
            if (gameState.roomCode) {
                alert("Phòng chơi đã bị đóng. Quay về màn hình chính.");
                cleanUpAfterLeave(gameState.roomCode);
                roomRef.off();
            }
            return;
        }

        const players = roomData.players || {};
        const playerCount = Object.keys(players).length;
        const maxPlayers = roomData.maxPlayers || 2;

        const previousStatus = gameState.roomStatus;
        gameState.roomStatus = roomData.status;

        if (previousStatus === 'finished' && roomData.status === 'waiting') {
            console.log("New round started by host. Resetting client state.");
            resetClientForNewRound();
        }

        // New player join notification
        const currentPlayerIds = new Set(Object.keys(players));
        let newPlayerId = null;
        for (const id of currentPlayerIds) {
            if (!gameState.knownPlayerIds.has(id)) {
                newPlayerId = id;
                break;
            }
        }
        if (newPlayerId && newPlayerId !== gameState.playerId && gameState.knownPlayerIds.size > 0) {
            const newPlayer = players[newPlayerId];
            if (newPlayer) {
                alert(`${newPlayer.displayName} đã vào phòng!`);
            }
        }
        gameState.knownPlayerIds = currentPlayerIds;

        // Host clean stale player
        if (gameState.playerRole === 'host') {
            const now = Date.now();
            const STALE_THRESHOLD = 30 * 1000;
            Object.entries(players).forEach(([playerId, playerData]) => {
                if (playerData.disconnectedAt && (now - playerData.disconnectedAt > STALE_THRESHOLD)) {
                    console.log(`Host cleaning up stale player: ${playerData.displayName}`);
                    database.ref(`rooms/${roomCode}/players/${playerId}`).remove();
                }
            });
        }

        // Process called numbers
        const calledNumbersData = roomData.calledNumbers || {};
        const calledNumbers = Object.keys(calledNumbersData).map(Number);
        const newNumbers = calledNumbers.filter(num => !gameState.calledNumbers.has(num));

        if (newNumbers.length > 0) {
            newNumbers.forEach(num => {
                gameState.calledNumbers.add(num);
                checkBoardForCalledNumber(num);
            });
            updateCallerDisplay();
            audioManager.playPopSound();
        }

        // Update in-game UI
        if (gameState.roomCode) {
            DOMElements.gameRoomInfo.classList.remove('hidden');
            DOMElements.gameRoomCode.textContent = gameState.roomCode;
            DOMElements.playerListContainer.classList.remove('hidden');
            renderPlayerList(players);
        }

        // Update Lobby UI
        if (DOMElements.mainModal.classList.contains('visible') && roomData.status === 'waiting') {
            renderLobbyPlayerList(players);
            DOMElements.waitingForPlayerText.textContent = `Đang chờ người chơi... (${playerCount}/${maxPlayers})`;

            if (gameState.playerRole === 'host') {
                DOMElements.startGameBtn.classList.remove('hidden');
                const canStart = playerCount >= 2;
                DOMElements.startGameBtn.disabled = !canStart;
                DOMElements.startGameBtn.title = canStart ? 'Bắt đầu trận đấu' : 'Cần ít nhất 2 người chơi trong phòng.';
            }
        }

        if (!DOMElements.roomInfoDisplay.classList.contains('hidden')) {
            DOMElements.waitingForPlayerText.textContent = `Đang chờ người chơi... (${playerCount}/${maxPlayers})`;
        }

        updateTurnUI(roomData);

        // Handle Game Over
        if (roomData.status === 'finished' && roomData.winner && !gameState.isGameOver) {
            gameState.isGameOver = true;
            DOMElements.bingoGrid.classList.add('locked');
            DOMElements.turnStatusDisplay.classList.add('hidden');
            clearInterval(turnTimerInterval);

            if (roomData.winner.playerId === gameState.playerId) {
                showVictoryModal(true);
            } else {
                showVictoryModal(false, roomData.winner.displayName);
            }
        }

        if (roomData.status === 'playing' && DOMElements.mainModal.classList.contains('visible')) {
            hideMultiplayerModal();
        }
    });
}

async function validateAndLockBoard() {
    if (gameState.isBoardLocked) return;

    const currentNumbers = new Set();
    let isValid = true;
    const inputs = DOMElements.bingoGrid.querySelectorAll('input');

    inputs.forEach((input, index) => {
        const num = parseInt(input.value);
        input.classList.remove('invalid');

        if (isNaN(num) || num < MIN_NUMBER || num > MAX_NUMBER) {
            isValid = false;
            input.classList.add('invalid');
            input.focus();
        } else if (currentNumbers.has(num)) {
            isValid = false;
            input.classList.add('invalid');
            input.focus();
        } else {
            currentNumbers.add(num);
            gameState.bingoBoard[index] = num;
        }
    });

    if (currentNumbers.size !== TOTAL_CELLS) {
        isValid = false;
    }

    if (isValid) {
        gameState.isBoardLocked = true;
        renderBingoGrid();
        DOMElements.randomFillBtn.disabled = true;
        DOMElements.lockBoardBtn.disabled = true;
        DOMElements.lockBoardBtn.querySelector('.button-text').textContent = 'Đang chờ đối thủ...';

        try {
            const playerRef = database.ref(`rooms/${gameState.roomCode}/players/${gameState.playerId}`);
            await playerRef.update({
                isReady: true,
                board: gameState.bingoBoard
            });
            console.log('Player is ready. Board sent to Firebase.');
        } catch (error) {
            console.error("Failed to set ready status:", error);
            alert("Có lỗi xảy ra khi khóa bảng. Vui lòng thử lại.");
            gameState.isBoardLocked = false;
            renderBingoGrid();
            DOMElements.randomFillBtn.disabled = false;
            DOMElements.lockBoardBtn.disabled = false;
            DOMElements.lockBoardBtn.querySelector('.button-text').textContent = '🔒 Khóa Bảng & Bắt Đầu';
        }
    } else {
        alert('Vui lòng điền đủ 25 số duy nhất từ 1-25 vào bảng.');
    }
}

function checkBoardForCalledNumber(calledNum) {
    gameState.bingoBoard.forEach((boardNum, index) => {
        if (boardNum === calledNum) {
            toggleCellSelection(index, true);
        }
    });
}

async function handleCellPick(index) {
    if (!gameState.isBoardLocked || gameState.isGameOver || gameState.playerId !== gameState.currentTurnPlayerId) {
        return;
    }

    const numberToCall = gameState.bingoBoard[index];
    const roomRef = database.ref('rooms/' + gameState.roomCode);
    const roomSnapshot = await roomRef.once('value');
    const roomData = roomSnapshot.val();

    if (roomData.calledNumbers && roomData.calledNumbers[numberToCall]) {
        console.log(`Number ${numberToCall} has already been called.`);
        return;
    }

    const playerOrder = roomData.playerOrder;
    const currentPlayerIndex = playerOrder.indexOf(gameState.playerId);
    const nextPlayerIndex = (currentPlayerIndex + 1) % playerOrder.length;
    const nextPlayerId = playerOrder[nextPlayerIndex];

    const updates = {};
    updates[`/calledNumbers/${numberToCall}`] = true;
    updates['/turnStartedAt'] = firebase.database.ServerValue.TIMESTAMP;
    updates['/turn'] = nextPlayerId;

    await roomRef.update(updates);
    console.log(`Player ${gameState.user.displayName} called number ${numberToCall}. Next turn: ${nextPlayerId}`);
}

async function handleNewRoundByHost() {
    if (gameState.playerRole !== 'host' || !gameState.roomCode) return;

    const roomRef = database.ref('rooms/' + gameState.roomCode);
    const snapshot = await roomRef.once('value');
    const roomData = snapshot.val();
    if (!roomData || roomData.status !== 'finished') return;

    // Reset isReady for all players for the new round
    const playerUpdates = {};
    Object.keys(roomData.players || {}).forEach(pid => {
        playerUpdates[`/players/${pid}/isReady`] = false;
    });
    await roomRef.update(playerUpdates);

    await roomRef.update({
        status: 'waiting',
        winner: null,
        calledNumbers: {},
        turn: null,
        turnStartedAt: null,
    });
}
async function handleStartGameClick() {
    if (gameState.playerRole !== 'host' || !gameState.roomCode) return;

    const roomRef = database.ref('rooms/' + gameState.roomCode);
    const snapshot = await roomRef.once('value');
    const roomData = snapshot.val();

    if (!roomData || roomData.status !== 'waiting') return;

    const players = roomData.players || {};
    const playerIds = Object.keys(players);

    if (playerIds.length < 2) {
        alert("Không thể bắt đầu! Cần ít nhất 2 người chơi trong phòng.");
        return;
    }

    // Reset trạng thái isReady cho tất cả người chơi cho vòng mới
    const playerUpdates = {};
    playerIds.forEach(pid => {
        playerUpdates[`/players/${pid}/isReady`] = false;
    });
    await roomRef.update(playerUpdates);

    // Xáo trộn thứ tự người chơi cho công bằng
    const playerOrder = shuffleArray(playerIds);

    const updates = {
        status: 'playing', // Trò chơi bắt đầu, người chơi thấy bảng
        playerOrder: playerOrder,
        turn: null,
        turnStartedAt: null,
        calledNumbers: {}, // Reset các số đã gọi cho ván mới
    };

    await roomRef.update(updates);
}

function toggleCellSelection(index, fromCaller = false) {
    if (!gameState.isBoardLocked || gameState.isGameOver) return;

    const cellElement = DOMElements.bingoGrid.children[index];
    gameState.selectedCells[index] = !gameState.selectedCells[index];

    if (gameState.selectedCells[index]) {
        cellElement.classList.add('selected');
        audioManager.playPopSound();
    } else {
        cellElement.classList.remove('selected');
    }

    checkWinConditions();
}

function checkWinConditions(isInitialLoad = false) {
    if (gameState.isGameOver) return;

    DOMElements.bingoLinesSVG.innerHTML = `
        <defs>
            <linearGradient id="laserGradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="500" y2="500">
                <stop offset="0%" stop-color="var(--theme-primary)" />
                <stop offset="50%" stop-color="var(--theme-secondary)" />
                <stop offset="100%" stop-color="var(--theme-primary)" />
            </linearGradient>
        </defs>
    `;

    for (const cell of DOMElements.bingoGrid.children) {
        cell.classList.remove('completed-line');
    }

    const previouslyCompleted = new Set(gameState.linesCompleted);
    gameState.linesCompleted.clear();

    WINNING_LINES.forEach((line, lineIndex) => {
        const isLineComplete = line.every(cellIndex => gameState.selectedCells[cellIndex]);

        if (isLineComplete) {
            gameState.linesCompleted.add(lineIndex);
            drawLaserLine(line);

            line.forEach(cellIndex => {
                const cellElement = DOMElements.bingoGrid.children[cellIndex];
                if (cellElement) {
                    cellElement.classList.add('completed-line');
                }
            });

            if (!previouslyCompleted.has(lineIndex) && !isInitialLoad) {
                audioManager.playLaserSound();
            }
        }
    });

    gameState.totalLinesCompleted = gameState.linesCompleted.size;
    updateLinesCompletedDisplay();

    if (gameState.totalLinesCompleted >= BINGO_SIZE && !gameState.isGameOver) {
        gameState.isGameOver = true;
        const roomRef = database.ref('rooms/' + gameState.roomCode);
        roomRef.update({
            status: 'finished',
            winner: {
                playerId: gameState.playerId,
                displayName: gameState.user.displayName
            }
        });
    }
}

function drawLaserLine(lineIndices) {
    const svg = DOMElements.bingoLinesSVG;
    const VIRTUAL_GRID_SIZE = 500;
    const cellSize = VIRTUAL_GRID_SIZE / BINGO_SIZE;

    const startCellIndex = lineIndices[0];
    const endCellIndex = lineIndices[BINGO_SIZE - 1];

    const startRow = Math.floor(startCellIndex / BINGO_SIZE);
    const startCol = startCellIndex % BINGO_SIZE;
    const endRow = Math.floor(endCellIndex / BINGO_SIZE);
    const endCol = endCellIndex % BINGO_SIZE;

    const x1 = startCol * cellSize + cellSize / 2;
    const y1 = startRow * cellSize + cellSize / 2;
    const x2 = endCol * cellSize + cellSize / 2;
    const y2 = endRow * cellSize + cellSize / 2;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.classList.add('laser-line');

    svg.appendChild(line);
}

function addGridEventListeners() {
    const inputs = DOMElements.bingoGrid.querySelectorAll('.bingo-cell input');
    inputs.forEach((input, index) => {
        input.oninput = (event) => {
            if (gameState.isBoardLocked) return;

            let value = event.target.value;
            const currentInputIndex = index;

            if (value === '') {
                gameState.bingoBoard[currentInputIndex] = null;
                event.target.classList.remove('invalid');
                return;
            }
            if (value.length > 2) {
                value = value.slice(0, 2);
                event.target.value = value;
            }
            const num = parseInt(value);

            let isCurrentInputValid = true;
            if (isNaN(num) || num < MIN_NUMBER || num > MAX_NUMBER) {
                isCurrentInputValid = false;
            } else {
                const existingNumbers = new Set(
                    gameState.bingoBoard.filter((val, idx) => idx !== currentInputIndex && val !== null)
                );
                if (existingNumbers.has(num)) {
                    isCurrentInputValid = false;
                }
            }
            if (isCurrentInputValid) {
                gameState.bingoBoard[currentInputIndex] = num;
                event.target.classList.remove('invalid');
                if (value.length === 2 || (value.length === 1 && num > 9)) {
                    const nextInput = inputs[currentInputIndex + 1];
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            } else {
                gameState.bingoBoard[currentInputIndex] = null;
                event.target.classList.add('invalid');
                if (value !== '') {
                    event.target.value = '';
                }
            }
        };

        input.parentElement.onclick = () => handleCellPick(index);
    });
}

// --- 7. Event Listeners ---
DOMElements.randomFillBtn.addEventListener('click', fillBoardRandomly);
DOMElements.createRoomBtn.addEventListener('click', createRoom);
DOMElements.joinRoomBtn.addEventListener('click', joinRoom);
DOMElements.leaveRoomBtn.addEventListener('click', handleLeaveRoom);
DOMElements.startGameBtn.addEventListener('click', handleStartGameClick);
DOMElements.closeProfileModalBtn.addEventListener('click', closeProfileModal);
DOMElements.lockBoardBtn.addEventListener('click', validateAndLockBoard);
DOMElements.resetGameBtn.addEventListener('click', () => {
    if (gameState.playerRole === 'host') {
        handleNewRoundByHost();
    }
    hideVictoryModal();
});
DOMElements.newGameBtn.addEventListener('click', () => {
    if (confirm('Bạn có chắc chắn muốn quay về sảnh chính? Toàn bộ tiến trình hiện tại sẽ bị xóa.')) {
        initializeGame(true);
    }
});

DOMElements.toggleSoundBtn.addEventListener('click', () => {
    gameState.isMuted = !gameState.isMuted;
    audioManager.setMute(gameState.isMuted);
    updateSoundButtonUI();
});

DOMElements.themeSelector.addEventListener('click', (event) => {
    const themeBtn = event.target.closest('.theme-btn');
    if (!themeBtn) return;

    const themeName = themeBtn.dataset.theme;
    if (themeName) {
        applyTheme(themeName);
    }
});

document.querySelectorAll('.cyber-button').forEach(button => {
    button.addEventListener('click', applyRippleEffect);
});

DOMElements.roomCodeDisplay.addEventListener('click', () => {
    if (gameState.roomCode) {
        navigator.clipboard.writeText(gameState.roomCode).then(() => {
            alert(`Đã sao chép mã phòng: ${gameState.roomCode}`);
        });
    }
});

// --- 8. Initial Setup & Auth Handlers ---
async function handleAuthSubmit(event) {
    event.preventDefault();
    const email = DOMElements.authEmailInput.value.trim();
    const password = DOMElements.authPasswordInput.value;
    const username = DOMElements.authUsernameInput.value.trim();

    try {
        if (isRegisterMode) {
            if (!username) {
                displayAuthError("Vui lòng nhập tên hiển thị.");
                return;
            }
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: username });
            displayAuthSuccess("Đăng ký thành công!");
        } else {
            await auth.signInWithEmailAndPassword(email, password);
            displayAuthSuccess("Đăng nhập thành công!");
        }
    } catch (error) {
        displayAuthError(getFriendlyAuthError(error));
    }
}

DOMElements.authForm.addEventListener('submit', handleAuthSubmit);
document.getElementById('auth-toggle-link').addEventListener('click', toggleAuthMode);
DOMElements.avatarUploadInput.addEventListener('change', handleAvatarUpload);
addGridEventListeners();

DOMElements.authEmailInput.addEventListener('input', validateAuthInput);
DOMElements.authPasswordInput.addEventListener('input', validateAuthInput);
DOMElements.authUsernameInput.addEventListener('input', validateAuthInput);

DOMElements.userInfo.addEventListener('click', () => {
    DOMElements.userDropdown.classList.toggle('hidden');
});
DOMElements.viewProfileLink.addEventListener('click', () => {
    openProfileModal();
    DOMElements.userDropdown.classList.add('hidden');
});
DOMElements.logoutBtn.addEventListener('click', () => auth.signOut());

window.addEventListener('click', (event) => {
    if (gameState.user && !DOMElements.userProfileContainer.contains(event.target)) {
        DOMElements.userDropdown.classList.add('hidden');
    }
});

// --- 9. Session Management (Auto-logout) ---
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;
let inactivityTimer;

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (gameState.user) {
        inactivityTimer = setTimeout(() => {
            alert("Bạn đã không hoạt động trong 15 phút. Đang tự động đăng xuất để bảo mật.");
            auth.signOut();
        }, INACTIVITY_TIMEOUT);
    }
}

function setupActivityListeners() {
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
        window.addEventListener(event, resetInactivityTimer, { passive: true });
    });
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    DOMElements.authError.classList.add('hidden');
    DOMElements.authForm.reset();

    if (isRegisterMode) {
        DOMElements.authTitle.textContent = 'Đăng Ký';
        DOMElements.authUsernameInput.classList.remove('hidden');
        DOMElements.authUsernameInput.required = true;
        DOMElements.authSubmitBtn.textContent = 'Đăng Ký';
        DOMElements.authToggleText.innerHTML = 'Đã có tài khoản? <span id="auth-toggle-link" class="link-style">Đăng nhập</span>';
        DOMElements.authSubmitBtnText.textContent = 'Đăng Ký';
    } else {
        DOMElements.authTitle.textContent = 'Đăng Nhập';
        DOMElements.authUsernameInput.classList.add('hidden');
        DOMElements.authUsernameInput.required = false;
        DOMElements.authSubmitBtn.textContent = 'Đăng Nhập';
        DOMElements.authToggleText.innerHTML = 'Chưa có tài khoản? <span id="auth-toggle-link" class="link-style">Đăng ký ngay</span>';
        DOMElements.authSubmitBtnText.textContent = 'Đăng Nhập';
    }
    document.getElementById('auth-toggle-link').addEventListener('click', toggleAuthMode);
    if (!DOMElements.authUsernameInput.classList.contains('hidden')) {
        DOMElements.authUsernameInput.focus();
    } else {
        DOMElements.authEmailInput.focus();
    }
}

function validateAuthInput(event) {
    const input = event.target;
    let isValid = true;

    if (input.id === 'auth-email') {
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
    } else if (input.id === 'auth-password') {
        isValid = input.value.length >= 6;
    } else if (input.id === 'auth-username' && isRegisterMode) {
        isValid = input.value.trim().length > 0;
    }

    if (isValid) {
        input.classList.remove('invalid');
    } else {
        input.classList.add('invalid');
    }
    DOMElements.authError.classList.add('hidden');
}

function getFriendlyAuthError(error) {
    if (error.message === "Vui lòng nhập tên hiển thị.") {
        return error.message;
    }
    switch (error.code) {
        case 'auth/user-not-found':
            return 'Không tìm thấy người dùng với email này.';
        case 'auth/wrong-password':
            return 'Sai mật khẩu. Vui lòng thử lại.';
        case 'auth/email-already-in-use':
            return 'Email này đã được sử dụng.';
        case 'auth/weak-password':
            return 'Mật khẩu quá yếu. Vui lòng sử dụng ít nhất 6 ký tự.';
        case 'auth/invalid-email':
            return 'Địa chỉ email không hợp lệ.';
        default:
            return error.message;
    }
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file || !gameState.user) return;

    if (!file.type.startsWith('image/')) {
        alert('Vui lòng chọn một file ảnh (JPEG, PNG).');
        return;
    }
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        alert('Kích thước file quá lớn. Vui lòng chọn ảnh dưới 5MB.');
        return;
    }

    const statusEl = DOMElements.profileUploadStatus;
    statusEl.textContent = 'Đang tải ảnh lên...';
    statusEl.classList.remove('hidden');

    try {
        const fileExtension = file.name.split('.').pop();
        const filePath = `avatars/${gameState.user.uid}/profile.${fileExtension}`;
        const fileRef = storage.ref(filePath);

        const uploadTask = await fileRef.put(file);
        const downloadURL = await uploadTask.ref.getDownloadURL();

        await auth.currentUser.updateProfile({ photoURL: downloadURL });

        gameState.user.photoURL = downloadURL;
        DOMElements.userAvatar.src = downloadURL;
        DOMElements.profileAvatarPreview.src = downloadURL;

        statusEl.textContent = 'Cập nhật avatar thành công!';
        setTimeout(() => statusEl.classList.add('hidden'), 3000);
    } catch (error) {
        console.error("Avatar upload failed:", error);
        statusEl.textContent = 'Tải ảnh lên thất bại. Vui lòng thử lại.';
    }
}

auth.onAuthStateChanged(user => {
    if (user) {
        console.log("User signed in:", user.uid);
        gameState.user = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            photoURL: user.photoURL,
        };
        gameState.playerId = user.uid;

        DOMElements.userProfileContainer.classList.remove('hidden');
        DOMElements.userAvatar.src = gameState.user.photoURL || DEFAULT_AVATAR;
        DOMElements.userDisplayName.textContent = `Chào, ${gameState.user.displayName}`;

        const savedRoomCode = localStorage.getItem('activeRoomCode');
        if (savedRoomCode) {
            console.log(`Found saved room ${savedRoomCode}, attempting to rejoin.`);
            rejoinRoom(savedRoomCode);
        } else {
            DOMElements.authView.classList.add('hidden');
            DOMElements.lobbyView.classList.remove('hidden');
            DOMElements.mainModal.classList.add('visible');
            DOMElements.gameContainer.classList.add('hidden');
        }
        resetInactivityTimer();
    } else {
        console.log("User signed out.");
        gameState.user = null;
        gameState.playerId = null;

        localStorage.removeItem('activeRoomCode');
        clearTimeout(inactivityTimer);

        DOMElements.userProfileContainer.classList.add('hidden');
        DOMElements.authView.classList.remove('hidden');
        DOMElements.lobbyView.classList.add('hidden');
        DOMElements.mainModal.classList.add('visible');
        DOMElements.gameContainer.classList.add('hidden');
    }
    initializeGame(true);
});

function unlockAudio() {
    if (audioManager && audioManager.audioContext.state === 'suspended') {
        audioManager.audioContext.resume();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', unlockAudio, { once: true });
    setupActivityListeners();
});