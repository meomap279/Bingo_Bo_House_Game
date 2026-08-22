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
    notifiedEliminations: new Set(), // Người đã nhận thông báo bị loại (để tránh spam chat)
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
const MAX_SKIPPED_TURNS = 5; // Số lượt bỏ qua tối đa trước khi bị loại
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
    spectateRoomBtn: document.getElementById('spectate-room-btn'),
    spectatorJoinPlayBtn: document.getElementById('spectator-join-play-btn'),
    roomCodeInput: document.getElementById('room-code-input'),
    maxPlayersSelect: document.getElementById('max-players-select'),
    roomActions: document.getElementById('room-actions'),
    roomInfoDisplay: document.getElementById('room-info-display'),
    waitingForPlayerText: document.getElementById('waiting-for-player-text') || document.createElement('span'),
    lobbyPlayerListContainer: document.getElementById('lobby-player-list-container'),
    lobbyPlayerList: document.getElementById('lobby-player-list'),
    startGameBtn: document.getElementById('start-game-btn'),
    lobbyReadyBtn: document.getElementById('lobby-ready-btn'),
    lobbyLeaveRoomBtn: document.getElementById('lobby-leave-room-btn'),
    lobbyLogoutBtn: document.getElementById('lobby-logout-btn'),
    preRoomLogoutBtn: document.getElementById('pre-room-logout-btn'),
    gameLogoutBtn: document.getElementById('game-logout-btn'),
    roomCodeDisplay: document.getElementById('room-code-display'),
    leaveRoomBtn: document.getElementById('leave-room-btn'),
    victoryLeaveRoomBtn: document.getElementById('victory-leave-room-btn'),
    // Chat
    chatPanel: document.getElementById('chat-panel'),
    chatToggleBtn: document.getElementById('chat-toggle-btn'),
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    chatSendBtn: document.getElementById('chat-send-btn'),
    chatEmojiBtn: document.getElementById('chat-emoji-btn'),
    chatEmojiPopup: document.getElementById('chat-emoji-popup'),
    chatVoiceBtn: document.getElementById('chat-voice-btn'),
    voiceParticipants: document.getElementById('voice-participants'),
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
    // Friends
    openFriendsBtn: document.getElementById('open-friends-btn'),
    friendInviteBadge: document.getElementById('friend-invite-badge'),
    friendsModal: document.getElementById('friends-modal'),
    closeFriendsModalBtn: document.getElementById('close-friends-modal-btn'),
    friendsTabs: document.querySelectorAll('.friends-tab'),
    friendsPanel: document.getElementById('friends-panel'),
    addFriendPanel: document.getElementById('add-friend-panel'),
    invitesPanel: document.getElementById('invites-panel'),
    friendSearchInput: document.getElementById('friend-search-input'),
    friendSearchBtn: document.getElementById('friend-search-btn'),
    friendSearchResults: document.getElementById('friend-search-results'),
    addFriendInput: document.getElementById('add-friend-input'),
    addFriendBtn: document.getElementById('add-friend-btn'),
    addFriendResult: document.getElementById('add-friend-result'),
    invitesList: document.getElementById('invites-list'),
    friendsInviteTabBadge: document.getElementById('friends-invite-tab-badge'),
    // Game elements
    bingoGrid: document.getElementById('bingo-grid'),
    boardControls: document.getElementById('board-controls'),
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
let currentTimerKey = null;

function toMillis(value) {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'object') {
        if (typeof value['.sv'] === 'string') return null;
        if (typeof value.seconds === 'number') {
            return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
        }
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function applyTheme(themeName) {
    const theme = THEMES[themeName] || THEMES.cyan;
    Object.entries(theme).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
    });
    gameState.theme = themeName;
}

function setTurnStatusText(text) {
    if (!DOMElements.turnStatusText) return;
    if (DOMElements.turnStatusText.textContent === text) return;
    console.log('[text]', '=>', text);
    DOMElements.turnStatusText.textContent = text;
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
            knownPlayerIds: Array.from(gameState.knownPlayerIds || []),
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
            knownPlayerIds: new Set(savedState.knownPlayerIds || []),
        };
    } catch (e) {
        console.error("Failed to load game state:", e);
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

function applyRestoredBoard(savedState) {
    if (!savedState || !Array.isArray(savedState.bingoBoard)) return false;

    gameState.bingoBoard = savedState.bingoBoard.slice();
    gameState.selectedCells = Array.isArray(savedState.selectedCells)
        ? savedState.selectedCells.slice()
        : Array(TOTAL_CELLS).fill(false);
    gameState.calledNumbers = savedState.calledNumbers instanceof Set
        ? new Set(savedState.calledNumbers)
        : new Set();
    gameState.isBoardLocked = !!savedState.isBoardLocked;
    gameState.linesCompleted = savedState.linesCompleted instanceof Set
        ? new Set(savedState.linesCompleted)
        : new Set();
    gameState.totalLinesCompleted = gameState.linesCompleted.size;
    gameState.isGameOver = !!savedState.isGameOver;

    renderBingoGrid();
    updateCallerDisplay();
    updateLinesCompletedDisplay();

    if (gameState.isBoardLocked) {
        DOMElements.lockBoardBtn.querySelector('.button-text').textContent = '🔒 Bảng đã khóa';
        DOMElements.randomFillBtn.disabled = true;
        DOMElements.lockBoardBtn.disabled = true;
    }

    if (gameState.isGameOver) {
        DOMElements.bingoGrid.classList.add('bingo-victory');
    }
    return true;
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
    const defaults = {
        startVelocity: 35,
        spread: 360,
        ticks: 80,
        zIndex: 2000,
        colors: ['#00f2fe', '#9d4edd', '#ffb703', '#45e08f', '#ff4d6d'],
    };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    // Bắn pháo hoa ban đầu
    confetti({
        ...defaults,
        particleCount: 120,
        origin: { x: 0.5, y: 0.4 },
        scalar: 1.2,
    });

    const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
            return clearInterval(interval);
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.4), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.6, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

function showVictoryModal(isWinner = true, winnerName = '') {
    const winnerLabel = winnerName || 'Người chơi chiến thắng';

    if (isWinner) {
        DOMElements.gameOverTitle.textContent = '🏆 VICTORY! 🏆';
        DOMElements.gameOverMessage.textContent = `Người chiến thắng: ${winnerLabel}. Chúc mừng bạn đã hoàn thành BINGO!`;
        audioManager.playVictoryFanfare();
        triggerConfetti();
    } else {
        DOMElements.gameOverTitle.textContent = 'GAME OVER';
        DOMElements.gameOverMessage.textContent = `Người chiến thắng: ${winnerLabel}. Tự động rời phòng sau 5 giây...`;
    }
    DOMElements.gameOverMessage.dataset.winner = winnerLabel;

    // Ẩn nút chơi ván mới: sau game kết thúc, tất cả sẽ out phòng
    DOMElements.resetGameBtn.classList.add('hidden');
    DOMElements.resetGameBtn.disabled = true;

    DOMElements.victoryModal.classList.remove('hidden');
    DOMElements.victoryModal.classList.add('visible');

    scheduleAutoLeaveAfterGame();
}

function hideVictoryModal() {
    DOMElements.victoryModal.classList.remove('visible');
    DOMElements.victoryModal.classList.add('hidden');
}

let autoLeaveTimer = null;
function scheduleAutoLeaveAfterGame() {
    if (autoLeaveTimer) clearTimeout(autoLeaveTimer);
    let countdown = 5;
    const winnerLabel = DOMElements.gameOverMessage.dataset.winner || 'Người chơi chiến thắng';
    const isLocalWinner = DOMElements.gameOverTitle.textContent.includes('VICTORY');
    const tick = () => {
        if (!DOMElements.victoryModal.classList.contains('visible')) {
            autoLeaveTimer = null;
            return;
        }
        if (countdown <= 0) {
            autoLeaveTimer = null;
            hideVictoryModal();
            handleLeaveRoom();
            return;
        }
        if (isLocalWinner) {
            DOMElements.gameOverMessage.textContent = `Người chiến thắng: ${winnerLabel}. Chúc mừng bạn đã hoàn thành BINGO! Tự động rời phòng sau ${countdown}s...`;
        } else {
            DOMElements.gameOverMessage.textContent = `Người chiến thắng: ${winnerLabel}. Tự động rời phòng sau ${countdown}s...`;
        }
        countdown -= 1;
        autoLeaveTimer = setTimeout(tick, 1000);
    };
    tick();
}

function cancelAutoLeave() {
    if (autoLeaveTimer) {
        clearTimeout(autoLeaveTimer);
        autoLeaveTimer = null;
    }
}

function openChatPanel() {
    if (!DOMElements.chatPanel) return;
    DOMElements.chatPanel.classList.remove('hidden');
    DOMElements.chatPanel.classList.remove('is-collapsed');
    if (DOMElements.chatToggleBtn) DOMElements.chatToggleBtn.textContent = '▾';
}

function closeChatPanel() {
    if (!DOMElements.chatPanel) return;
    DOMElements.chatPanel.classList.add('hidden');
}

function toggleChatPanel() {
    if (!DOMElements.chatPanel) return;
    const collapsed = DOMElements.chatPanel.classList.toggle('is-collapsed');
    if (DOMElements.chatToggleBtn) DOMElements.chatToggleBtn.textContent = collapsed ? '▴' : '▾';
    if (!collapsed) {
        resetUnreadChat();
    }
}

function toggleChatEmojiPopup(force) {
    if (!DOMElements.chatEmojiPopup || !DOMElements.chatEmojiBtn) return;
    const willShow = typeof force === 'boolean'
        ? force
        : DOMElements.chatEmojiPopup.classList.contains('hidden');
    if (willShow) {
        DOMElements.chatEmojiPopup.classList.remove('hidden');
        DOMElements.chatEmojiBtn.classList.add('is-active');
    } else {
        DOMElements.chatEmojiPopup.classList.add('hidden');
        DOMElements.chatEmojiBtn.classList.remove('is-active');
    }
}

function formatChatTime(timestamp) {
    if (!timestamp) return '';
    const ms = typeof timestamp === 'number' ? timestamp : (timestamp.seconds ? timestamp.seconds * 1000 : Date.now());
    const date = new Date(ms);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

let unreadChatCount = 0;

function updateUnreadBadge() {
    const badge = DOMElements.chatPanel ? DOMElements.chatPanel.querySelector('.chat-unread-badge') : null;
    if (!badge) return;
    if (unreadChatCount > 0) {
        badge.textContent = unreadChatCount > 99 ? '99+' : String(unreadChatCount);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function resetUnreadChat() {
    unreadChatCount = 0;
    updateUnreadBadge();
}

function appendChatMessage({ uid, displayName, text, isSystem = false, at = null }) {
    if (!DOMElements.chatMessages) return;
    const isMine = uid && uid === gameState.playerId;
    const el = document.createElement('div');
    el.className = 'chat-msg' + (isSystem ? ' is-system' : '') + (isMine ? ' is-mine' : '');
    if (isSystem) {
        const time = document.createElement('span');
        time.className = 'chat-time';
        time.textContent = formatChatTime(at);
        const textEl = document.createElement('span');
        textEl.textContent = text;
        el.appendChild(time);
        el.appendChild(textEl);
    } else {
        const author = document.createElement('span');
        author.className = 'author';
        author.textContent = displayName || 'Người chơi';
        const body = document.createElement('span');
        body.textContent = text;
        const time = document.createElement('span');
        time.className = 'chat-time';
        time.textContent = formatChatTime(at);
        el.appendChild(author);
        el.appendChild(body);
        el.appendChild(time);
    }
    DOMElements.chatMessages.appendChild(el);
    DOMElements.chatMessages.scrollTop = DOMElements.chatMessages.scrollHeight;
    // Giữ tối đa 100 tin nhắn trên DOM
    while (DOMElements.chatMessages.children.length > 100) {
        DOMElements.chatMessages.removeChild(DOMElements.chatMessages.firstChild);
    }
    // Đếm tin nhắn chưa đọc nếu chat đang thu gọn và tin nhắn không phải của mình
    const collapsed = DOMElements.chatPanel && DOMElements.chatPanel.classList.contains('is-collapsed');
    if (collapsed && !isMine) {
        unreadChatCount += 1;
        updateUnreadBadge();
    }
}

function clearChatMessages() {
    if (DOMElements.chatMessages) DOMElements.chatMessages.innerHTML = '';
    resetUnreadChat();
}

function sendChatMessage(text) {
    if (!gameState.roomCode || !gameState.playerId || !gameState.user) return;
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const chatRef = database.ref(`rooms/${gameState.roomCode}/chat`).push();
    return chatRef.set({
        uid: gameState.playerId,
        displayName: gameState.user.displayName || 'Người chơi',
        text: trimmed,
        at: firebase.database.ServerValue.TIMESTAMP,
    });
}

function listenForChatEvents(roomCode) {
    const chatRef = database.ref(`rooms/${roomCode}/chat`).limitToLast(50);
    chatRef.off();
    chatRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        if (!msg) return;
        appendChatMessage(msg);
    });
}

function stopChatListener() {
    if (gameState.roomCode) {
        database.ref(`rooms/${gameState.roomCode}/chat`).off();
    }
}

/* ===== Voice Chat (WebRTC mesh) ===== */

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const voiceState = {
    localStream: null,
    isMicOn: false,
    peers: {}, // peerId -> { pc, audio }
    listeningPeers: {}, // peerId chưa gửi offer (để biết khi nào cần gửi)
};

function setVoiceButton(isOn) {
    if (!DOMElements.chatVoiceBtn) return;
    DOMElements.chatVoiceBtn.classList.toggle('is-on', !!isOn);
    DOMElements.chatVoiceBtn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    const stateEl = DOMElements.chatVoiceBtn.querySelector('.voice-state');
    if (stateEl) stateEl.textContent = isOn ? 'Đang nói' : 'Off';
}

function renderVoiceParticipants(peerIds, players) {
    if (!DOMElements.voiceParticipants) return;
    DOMElements.voiceParticipants.innerHTML = '';
    peerIds.forEach(pid => {
        const player = players && players[pid];
        const item = document.createElement('span');
        item.className = 'voice-participant';
        const avatar = (player && player.photoURL) || DEFAULT_AVATAR;
        item.innerHTML = `<img src="${avatar}" alt=""> ${player ? (player.displayName || 'Người chơi') : 'Người chơi'}`;
        DOMElements.voiceParticipants.appendChild(item);
    });
}

async function startLocalMic() {
    if (voiceState.localStream) return voiceState.localStream;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
        });
        voiceState.localStream = stream;
        voiceState.isMicOn = true;
        setVoiceButton(true);
        return stream;
    } catch (error) {
        console.error('Cannot access microphone:', error);
        alert('Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.');
        return null;
    }
}

function stopLocalMic() {
    if (voiceState.localStream) {
        voiceState.localStream.getTracks().forEach(t => t.stop());
        voiceState.localStream = null;
    }
    voiceState.isMicOn = false;
    setVoiceButton(false);
}

function createPeerConnection(peerId) {
    if (voiceState.peers[peerId] && voiceState.peers[peerId].pc) {
        return voiceState.peers[peerId].pc;
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    voiceState.peers[peerId] = { pc, audio: null };

    if (voiceState.localStream) {
        voiceState.localStream.getTracks().forEach(track => {
            pc.addTrack(track, voiceState.localStream);
        });
    }

    pc.ontrack = (event) => {
        const [stream] = event.streams;
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.play().catch(() => {});
        voiceState.peers[peerId].audio = audio;
    };

    pc.onicecandidate = (event) => {
        if (event.candidate && gameState.roomCode) {
            database.ref(`rooms/${gameState.roomCode}/voice/${peerId}/${gameState.playerId}`).push({
                type: 'candidate',
                candidate: event.candidate.toJSON(),
            });
        }
    };

    pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'failed' || state === 'closed' || state === 'disconnected') {
            // Có thể cần reconnect sau này
        }
    };

    return pc;
}

function sendSignal(toId, payload) {
    if (!gameState.roomCode) return;
    database.ref(`rooms/${gameState.roomCode}/voice/${toId}/${gameState.playerId}`).push(payload);
}

async function callPeer(peerId) {
    if (!voiceState.isMicOn) return;
    const pc = createPeerConnection(peerId);
    try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(peerId, { type: 'offer', sdp: offer });
    } catch (error) {
        console.error('callPeer failed:', error);
    }
}

async function handleOffer(fromId, sdp) {
    const pc = createPeerConnection(fromId);
    try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(fromId, { type: 'answer', sdp: answer });
        // Khi nhận offer từ người khác, ta cần stream của mình (nếu có) đã được add ở createPeerConnection
        if (!voiceState.localStream && voiceState.isMicOn) {
            // edge case: chưa có stream
        }
    } catch (error) {
        console.error('handleOffer failed:', error);
    }
}

async function handleAnswer(fromId, sdp) {
    const peer = voiceState.peers[fromId];
    if (!peer) return;
    try {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (error) {
        console.error('handleAnswer failed:', error);
    }
}

async function handleCandidate(fromId, candidate) {
    const peer = voiceState.peers[fromId];
    if (!peer) return;
    try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error('handleCandidate failed:', error);
    }
}

function listenForVoiceSignals(roomCode) {
    const myId = gameState.playerId;
    if (!myId) return;
    const ref = database.ref(`rooms/${roomCode}/voice/${myId}`);
    ref.off();
    ref.on('child_added', (snapshot) => {
        const payload = snapshot.val();
        const fromId = snapshot.key;
        if (!payload || !fromId) return;
        if (fromId === myId) return;
        if (payload.type === 'offer') {
            handleOffer(fromId, payload.sdp);
        } else if (payload.type === 'answer') {
            handleAnswer(fromId, payload.sdp);
        } else if (payload.type === 'candidate') {
            handleCandidate(fromId, payload.candidate);
        }
    });

    // Khi có người mới bật mic → ta sẽ gửi offer đến họ
    const presenceRef = database.ref(`rooms/${roomCode}/voice/${myId}/_presence`);
    presenceRef.on('value', (snapshot) => {
        const presence = snapshot.val() || {};
        Object.keys(presence).forEach(peerId => {
            if (peerId === myId) return;
            const meta = presence[peerId];
            if (!meta || !meta.micOn) return;
            // Gửi offer nếu mình cũng đang bật mic và chưa có peer
            if (voiceState.isMicOn && !voiceState.peers[peerId]) {
                callPeer(peerId);
            }
        });
    });
}

function publishMicState(isOn) {
    if (!gameState.roomCode || !gameState.playerId) return;
    const ref = database.ref(`rooms/${gameState.roomCode}/voice/${gameState.playerId}/_presence/${gameState.playerId}`);
    ref.onDisconnect().remove();
    ref.set({ micOn: !!isOn, at: firebase.database.ServerValue.TIMESTAMP });
}

function listenForVoicePresence(roomCode, players) {
    if (!DOMElements.voiceParticipants) return;
    const ref = database.ref(`rooms/${roomCode}/voice`);
    ref.off();
    ref.on('value', (snapshot) => {
        const data = snapshot.val() || {};
        const speakers = [];
        Object.entries(data).forEach(([peerId, info]) => {
            // info có thể là { _presence: { micOn }, payload signals... }
            const presence = info && info._presence && info._presence[peerId];
            if (presence && presence.micOn) {
                speakers.push(peerId);
            }
        });
        renderVoiceParticipants(speakers, players || {});
    });
}

async function toggleMicrophone() {
    if (!gameState.roomCode) {
        alert('Vui lòng vào phòng trước.');
        return;
    }
    if (voiceState.isMicOn) {
        stopLocalMic();
        publishMicState(false);
        // Đóng các peer connection cũ
        Object.values(voiceState.peers).forEach(peer => {
            try { peer.pc.close(); } catch (e) {}
        });
        voiceState.peers = {};
        renderVoiceParticipants([], {});
        return;
    }
    const stream = await startLocalMic();
    if (!stream) return;
    publishMicState(true);
    // Sau khi mic bật, lắng nghe sự hiện diện của các peer khác
    // Gọi tới những peer đang có micOn
    if (!gameState.roomCode) return;
    const otherPresence = database.ref(`rooms/${gameState.roomCode}/voice`);
    const snap = await otherPresence.once('value');
    const data = snap.val() || {};
    Object.entries(data).forEach(([peerId, info]) => {
        if (peerId === gameState.playerId) return;
        const presence = info && info._presence && info._presence[peerId];
        if (presence && presence.micOn) {
            callPeer(peerId);
        }
    });
}

function cleanupVoice() {
    stopLocalMic();
    Object.values(voiceState.peers).forEach(peer => {
        try { peer.pc.close(); } catch (e) {}
    });
    voiceState.peers = {};
    if (gameState.roomCode) {
        database.ref(`rooms/${gameState.roomCode}/voice/${gameState.playerId}`).off();
        database.ref(`rooms/${gameState.roomCode}/voice`).off();
        database.ref(`rooms/${gameState.roomCode}/voice/${gameState.playerId}/_presence/${gameState.playerId}`).remove();
    }
    if (DOMElements.voiceParticipants) DOMElements.voiceParticipants.innerHTML = '';
    setVoiceButton(false);
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
    DOMElements.profileModal.classList.remove('hidden');
    DOMElements.profileModal.classList.add('visible');
}

function closeProfileModal() {
    DOMElements.profileModal.classList.remove('visible');
    DOMElements.profileModal.classList.add('hidden');
}

/* ===== Friends & Invites ===== */

const friendsState = {
    friends: {},
    invites: {}, // friendInvites gửi đến mình
    roomInvites: {}, // roomInvites gửi đến mình
    friendStatuses: {}, // uid -> { online, lastSeen }
    lastNotifiedInviteIds: new Set(),
    lastNotifiedRoomInviteIds: new Set(),
};

function updateInviteBadges() {
    const inviteCount = Object.keys(friendsState.invites).length + Object.keys(friendsState.roomInvites).length;
    if (DOMElements.friendInviteBadge) {
        if (inviteCount > 0) {
            DOMElements.friendInviteBadge.textContent = inviteCount > 99 ? '99+' : String(inviteCount);
            DOMElements.friendInviteBadge.classList.remove('hidden');
        } else {
            DOMElements.friendInviteBadge.classList.add('hidden');
        }
    }
    if (DOMElements.friendsInviteTabBadge) {
        const n = inviteCount;
        if (n > 0) {
            DOMElements.friendsInviteTabBadge.textContent = n > 99 ? '99+' : String(n);
            DOMElements.friendsInviteTabBadge.classList.remove('hidden');
        } else {
            DOMElements.friendsInviteTabBadge.classList.add('hidden');
        }
    }
}

function openFriendsModal() {
    if (!DOMElements.friendsModal) return;
    DOMElements.friendsModal.classList.remove('hidden');
    DOMElements.friendsModal.classList.add('visible');
    switchFriendsTab('friends');
    renderFriendsList();
    renderInvitesList();
}

function closeFriendsModal() {
    if (!DOMElements.friendsModal) return;
    DOMElements.friendsModal.classList.remove('visible');
    DOMElements.friendsModal.classList.add('hidden');
}

function switchFriendsTab(tabName) {
    if (!DOMElements.friendsTabs) return;
    DOMElements.friendsTabs.forEach(tab => {
        tab.classList.toggle('is-active', tab.dataset.tab === tabName);
    });
    if (DOMElements.friendsPanel) DOMElements.friendsPanel.classList.toggle('hidden', tabName !== 'friends');
    if (DOMElements.addFriendPanel) DOMElements.addFriendPanel.classList.toggle('hidden', tabName !== 'add');
    if (DOMElements.invitesPanel) DOMElements.invitesPanel.classList.toggle('hidden', tabName !== 'invites');
    if (tabName === 'invites') renderInvitesList();
    if (tabName === 'friends') renderFriendsList();
}

function renderFriendsList() {
    if (!DOMElements.friendSearchResults) return;
    DOMElements.friendSearchResults.innerHTML = '';
    const friendIds = Object.keys(friendsState.friends);
    if (friendIds.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'friend-hint';
        hint.textContent = 'Bạn chưa có bạn bè nào. Vào tab "Thêm bạn" để kết bạn.';
        DOMElements.friendSearchResults.appendChild(hint);
        return;
    }
    friendIds.forEach(fid => {
        const friend = friendsState.friends[fid];
        if (!friend) return;
        const status = friendsState.friendStatuses[fid] || {};
        const item = document.createElement('div');
        item.className = 'friend-item';
        item.innerHTML = `
            <img src="${friend.photoURL || DEFAULT_AVATAR}" alt="">
            <span class="friend-name">${friend.displayName || 'Người chơi'}</span>
            <span class="friend-status ${status.online ? 'is-online' : ''}">${status.online ? 'Online' : 'Offline'}</span>
            <div class="friend-actions">
                <button class="mini-btn invite-room-btn" data-uid="${fid}">🎮 Mời</button>
                <button class="mini-btn is-danger remove-friend-btn" data-uid="${fid}">Xoá</button>
            </div>
        `;
        DOMElements.friendSearchResults.appendChild(item);
    });
    DOMElements.friendSearchResults.querySelectorAll('.invite-room-btn').forEach(btn => {
        btn.addEventListener('click', () => inviteFriendToRoom(btn.dataset.uid));
    });
    DOMElements.friendSearchResults.querySelectorAll('.remove-friend-btn').forEach(btn => {
        btn.addEventListener('click', () => removeFriend(btn.dataset.uid));
    });
}

function renderInvitesList() {
    if (!DOMElements.invitesList) return;
    DOMElements.invitesList.innerHTML = '';
    const friendInvites = Object.entries(friendsState.invites);
    const roomInvites = Object.entries(friendsState.roomInvites);
    if (friendInvites.length === 0 && roomInvites.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'friend-hint';
        hint.textContent = 'Bạn không có lời mời nào.';
        DOMElements.invitesList.appendChild(hint);
        return;
    }
    friendInvites.forEach(([inviteId, invite]) => {
        const item = document.createElement('div');
        item.className = 'friend-item';
        item.innerHTML = `
            <img src="${invite.photoURL || DEFAULT_AVATAR}" alt="">
            <span class="friend-name">${invite.displayName || 'Người chơi'}</span>
            <div class="friend-actions">
                <button class="mini-btn accept-friend-btn" data-id="${inviteId}">Chấp nhận</button>
                <button class="mini-btn is-danger reject-friend-btn" data-id="${inviteId}">Từ chối</button>
            </div>
        `;
        DOMElements.invitesList.appendChild(item);
    });
    roomInvites.forEach(([inviteId, invite]) => {
        const item = document.createElement('div');
        item.className = 'friend-item';
        item.innerHTML = `
            <img src="${invite.photoURL || DEFAULT_AVATAR}" alt="">
            <span class="friend-name">${invite.displayName || 'Người chơi'} - Mời vào phòng #${invite.roomCode}</span>
            <div class="friend-actions">
                <button class="mini-btn accept-room-btn" data-id="${inviteId}">Vào phòng</button>
                <button class="mini-btn is-danger reject-room-btn" data-id="${inviteId}">Từ chối</button>
            </div>
        `;
        DOMElements.invitesList.appendChild(item);
    });
    DOMElements.invitesList.querySelectorAll('.accept-friend-btn').forEach(btn => {
        btn.addEventListener('click', () => acceptFriendInvite(btn.dataset.id));
    });
    DOMElements.invitesList.querySelectorAll('.reject-friend-btn').forEach(btn => {
        btn.addEventListener('click', () => rejectFriendInvite(btn.dataset.id));
    });
    DOMElements.invitesList.querySelectorAll('.accept-room-btn').forEach(btn => {
        btn.addEventListener('click', () => acceptRoomInvite(btn.dataset.id));
    });
    DOMElements.invitesList.querySelectorAll('.reject-room-btn').forEach(btn => {
        btn.addEventListener('click', () => rejectRoomInvite(btn.dataset.id));
    });
}

async function searchUsersByName(query) {
    if (!query || query.trim().length < 2) return [];
    const lower = query.trim().toLowerCase();
    // Cách đơn giản: quét index users theo displayNameLowercase nếu có; nếu không, fallback scan toàn bộ (giới hạn).
    // Ở đây dùng fallback scan với giới hạn 50 user mỗi lần.
    const snap = await database.ref('users').orderByChild('displayNameLowercase').startAt(lower).endAt(lower + '\uf8ff').limitToFirst(50).once('value');
    const data = snap.val() || {};
    return Object.entries(data).map(([uid, val]) => ({ uid, ...val })).filter(u => u.uid !== gameState.playerId);
}

async function sendFriendInvite(toUid) {
    if (!gameState.user || !gameState.playerId || !toUid) return;
    if (toUid === gameState.playerId) return;
    const ref = database.ref(`users/${toUid}/friendInvites`).push();
    await ref.set({
        fromUid: gameState.playerId,
        displayName: gameState.user.displayName,
        photoURL: gameState.user.photoURL || null,
        at: firebase.database.ServerValue.TIMESTAMP,
    });
    alert('Đã gửi lời mời kết bạn.');
}

async function acceptFriendInvite(inviteId) {
    const invite = friendsState.invites[inviteId];
    if (!invite) return;
    const myUid = gameState.playerId;
    if (!myUid) return;
    const fromUid = invite.fromUid;
    try {
        await database.ref(`users/${myUid}/friends/${fromUid}`).set({
            displayName: invite.displayName,
            photoURL: invite.photoURL,
            since: firebase.database.ServerValue.TIMESTAMP,
        });
        await database.ref(`users/${fromUid}/friends/${myUid}`).set({
            displayName: gameState.user.displayName,
            photoURL: gameState.user.photoURL,
            since: firebase.database.ServerValue.TIMESTAMP,
        });
        await database.ref(`users/${myUid}/friendInvites/${inviteId}`).remove();
        delete friendsState.invites[inviteId];
        renderInvitesList();
        renderFriendsList();
        updateInviteBadges();
    } catch (e) {
        console.error('Failed to accept friend invite:', e);
    }
}

async function rejectFriendInvite(inviteId) {
    try {
        await database.ref(`users/${gameState.playerId}/friendInvites/${inviteId}`).remove();
        delete friendsState.invites[inviteId];
        renderInvitesList();
        updateInviteBadges();
    } catch (e) {
        console.error(e);
    }
}

async function removeFriend(friendUid) {
    if (!confirm('Bạn có chắc muốn xoá bạn này?')) return;
    const myUid = gameState.playerId;
    if (!myUid) return;
    try {
        await database.ref(`users/${myUid}/friends/${friendUid}`).remove();
        await database.ref(`users/${friendUid}/friends/${myUid}`).remove();
        delete friendsState.friends[friendUid];
        renderFriendsList();
    } catch (e) {
        console.error('Failed to remove friend:', e);
    }
}

async function inviteFriendToRoom(friendUid) {
    if (!gameState.roomCode) {
        alert('Bạn cần vào phòng trước khi mời.');
        return;
    }
    try {
        await database.ref(`users/${friendUid}/roomInvites`).push({
            fromUid: gameState.playerId,
            displayName: gameState.user.displayName,
            photoURL: gameState.user.photoURL,
            roomCode: gameState.roomCode,
            at: firebase.database.ServerValue.TIMESTAMP,
        });
        alert('Đã gửi lời mời vào phòng.');
    } catch (e) {
        console.error('Failed to invite:', e);
    }
}

async function acceptRoomInvite(inviteId) {
    const invite = friendsState.roomInvites[inviteId];
    if (!invite) return;
    // Rời phòng hiện tại nếu có rồi vào phòng mới
    if (gameState.roomCode) {
        await handleLeaveRoom();
    }
    if (DOMElements.roomCodeInput) DOMElements.roomCodeInput.value = invite.roomCode;
    await joinRoom();
    await database.ref(`users/${gameState.playerId}/roomInvites/${inviteId}`).remove();
    delete friendsState.roomInvites[inviteId];
    renderInvitesList();
    updateInviteBadges();
}

async function rejectRoomInvite(inviteId) {
    try {
        await database.ref(`users/${gameState.playerId}/roomInvites/${inviteId}`).remove();
        delete friendsState.roomInvites[inviteId];
        renderInvitesList();
        updateInviteBadges();
    } catch (e) {
        console.error(e);
    }
}

function setupUserProfile() {
    const myUid = gameState.playerId;
    if (!myUid) return;
    const profileRef = database.ref(`users/${myUid}`);
    profileRef.update({
        displayName: gameState.user.displayName,
        displayNameLowercase: (gameState.user.displayName || '').toLowerCase(),
        photoURL: gameState.user.photoURL || null,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
    }).catch(() => {});
    profileRef.child('lastSeen').onDisconnect().set(Date.now());
    // Presence: ghi online = true; off thì set false
    const statusRef = database.ref(`users/${myUid}/status`);
    statusRef.onDisconnect().set({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    statusRef.set({ online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });

    // Lắng nghe friends, friendInvites, roomInvites
    database.ref(`users/${myUid}/friends`).on('value', (snap) => {
        friendsState.friends = snap.val() || {};
        renderFriendsList();
        // Đồng thời lắng nghe status của từng friend
        Object.keys(friendsState.friends).forEach(fid => {
            if (!friendsState.friendStatuses[fid] || !friendsState.friendStatuses[fid].__listening) {
                friendsState.friendStatuses[fid] = friendsState.friendStatuses[fid] || {};
                friendsState.friendStatuses[fid].__listening = true;
                database.ref(`users/${fid}/status`).on('value', (s) => {
                    const v = s.val();
                    friendsState.friendStatuses[fid] = v || {};
                    friendsState.friendStatuses[fid].__listening = true;
                    renderFriendsList();
                });
            }
        });
    });
    database.ref(`users/${myUid}/friendInvites`).on('child_added', (snap) => {
        const id = snap.key;
        const val = snap.val();
        if (!val) return;
        friendsState.invites[id] = val;
        updateInviteBadges();
        if (!friendsState.lastNotifiedInviteIds.has(id)) {
            friendsState.lastNotifiedInviteIds.add(id);
            alert(`${val.displayName || 'Người chơi'} muốn kết bạn với bạn!`);
        }
        if (DOMElements.invitesPanel && !DOMElements.invitesPanel.classList.contains('hidden')) {
            renderInvitesList();
        }
    });
    database.ref(`users/${myUid}/friendInvites`).on('child_removed', (snap) => {
        delete friendsState.invites[snap.key];
        updateInviteBadges();
        renderInvitesList();
    });
    database.ref(`users/${myUid}/roomInvites`).on('child_added', (snap) => {
        const id = snap.key;
        const val = snap.val();
        if (!val) return;
        friendsState.roomInvites[id] = val;
        updateInviteBadges();
        if (!friendsState.lastNotifiedRoomInviteIds.has(id)) {
            friendsState.lastNotifiedRoomInviteIds.add(id);
            alert(`${val.displayName || 'Người chơi'} mời bạn vào phòng #${val.roomCode}!`);
        }
        if (DOMElements.invitesPanel && !DOMElements.invitesPanel.classList.contains('hidden')) {
            renderInvitesList();
        }
    });
    database.ref(`users/${myUid}/roomInvites`).on('child_removed', (snap) => {
        delete friendsState.roomInvites[snap.key];
        updateInviteBadges();
        renderInvitesList();
    });
}

function teardownUserProfile() {
    const myUid = gameState.playerId;
    if (!myUid) return;
    database.ref(`users/${myUid}/friends`).off();
    database.ref(`users/${myUid}/friendInvites`).off();
    database.ref(`users/${myUid}/roomInvites`).off();
    Object.keys(friendsState.friendStatuses).forEach(fid => {
        database.ref(`users/${fid}/status`).off();
    });
    friendsState.friends = {};
    friendsState.invites = {};
    friendsState.roomInvites = {};
    friendsState.friendStatuses = {};
    friendsState.lastNotifiedInviteIds = new Set();
    friendsState.lastNotifiedRoomInviteIds = new Set();
    updateInviteBadges();
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
    if (DOMElements.turnStatusText) DOMElements.turnStatusText.textContent = '';
    currentTimerKey = null;

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
    const hasActiveRoom = !!localStorage.getItem('activeRoomCode');
    if (!hasActiveRoom) {
        localStorage.removeItem(STORAGE_KEY);
    }
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
    gameState.notifiedEliminations = new Set();

    if (gameState.user) {
        DOMElements.authView.classList.add('hidden');
        DOMElements.lobbyView.classList.remove('hidden');
    } else {
        DOMElements.authView.classList.remove('hidden');
        DOMElements.lobbyView.classList.add('hidden');
    }
    DOMElements.roomActions.classList.remove('hidden');
    DOMElements.roomInfoDisplay.classList.add('hidden');
    DOMElements.createRoomBtn.disabled = false;
    DOMElements.joinRoomBtn.disabled = false;
    renderBingoGrid();
    DOMElements.startGameBtn.classList.add('hidden');
    DOMElements.startGameBtn.disabled = true;
    DOMElements.lobbyReadyBtn.classList.add('hidden');
    DOMElements.lobbyReadyBtn.disabled = false;
    DOMElements.lobbyLeaveRoomBtn.disabled = false;
    DOMElements.leaveRoomBtn.classList.add('hidden');
    if (DOMElements.spectateRoomBtn) DOMElements.spectateRoomBtn.disabled = false;
    if (DOMElements.spectatorJoinPlayBtn) DOMElements.spectatorJoinPlayBtn.classList.add('hidden');
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
    const roomCode = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
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
        lastWinnerId: localStorage.getItem('lastWinnerId') || null,
        lastWinnerName: localStorage.getItem('lastWinnerName') || null,
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
        DOMElements.lobbyLeaveRoomBtn.disabled = false;
        DOMElements.createRoomBtn.disabled = false;

        listenForGameEvents(roomCode);
        listenForChatEvents(roomCode);
        listenForVoiceSignals(roomCode);
        listenForVoicePresence(roomCode, null);
        clearChatMessages();
        appendChatMessage({ isSystem: true, text: `Bạn đã vào phòng #${roomCode}` });
        openChatPanel();
    } catch (error) {
        console.error("Failed to create room:", error);
        alert("Không thể tạo phòng. Vui lòng thử lại.");
        DOMElements.createRoomBtn.disabled = false;
    }
}

async function joinRoom() {
    const roomCode = DOMElements.roomCodeInput.value.trim();
    if (!/^\d{5}$/.test(roomCode)) {
        alert("Mã phòng phải gồm đúng 5 số.");
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
        alert("Phòng đã đầy người chơi. Bạn có thể vào với vai trò Khán Giả (Xem).");
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
        DOMElements.lobbyLeaveRoomBtn.disabled = false;
        DOMElements.joinRoomBtn.disabled = false;

        const playerRef = database.ref(`rooms/${roomCode}/players/${gameState.playerId}`);
        playerRef.onDisconnect().update({ disconnectedAt: firebase.database.ServerValue.TIMESTAMP });
        localStorage.setItem('activeRoomCode', roomCode);

        listenForGameEvents(roomCode);
        listenForChatEvents(roomCode);
        listenForVoiceSignals(roomCode);
        listenForVoicePresence(roomCode, null);
        clearChatMessages();
        appendChatMessage({ isSystem: true, text: `Bạn đã vào phòng #${roomCode}` });
        openChatPanel();
    } catch (error) {
        console.error("Failed to join room:", error);
        alert("Không thể vào phòng. Vui lòng thử lại.");
        DOMElements.joinRoomBtn.disabled = false;
    }
}

async function spectateRoom() {
    const roomCode = DOMElements.roomCodeInput.value.trim();
    if (!/^\d{5}$/.test(roomCode)) {
        alert("Mã phòng phải gồm đúng 5 số.");
        return;
    }

    DOMElements.spectateRoomBtn.disabled = true;
    const roomRef = database.ref('rooms/' + roomCode);
    const snapshot = await roomRef.once('value');

    if (!snapshot.exists()) {
        alert("Phòng không tồn tại!");
        DOMElements.spectateRoomBtn.disabled = false;
        return;
    }

    try {
        gameState.roomCode = roomCode;
        gameState.playerRole = 'spectator';
        await roomRef.child('spectators').child(gameState.playerId).set({
            displayName: gameState.user.displayName,
            photoURL: gameState.user.photoURL || null,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            disconnectedAt: null,
        });
        const specRef = database.ref(`rooms/${roomCode}/spectators/${gameState.playerId}`);
        specRef.onDisconnect().update({ disconnectedAt: firebase.database.ServerValue.TIMESTAMP });
        localStorage.setItem('activeRoomCode', roomCode);

        DOMElements.roomActions.classList.add('hidden');
        DOMElements.roomInfoDisplay.classList.remove('hidden');
        DOMElements.roomCodeDisplay.textContent = roomCode;
        DOMElements.lobbyLeaveRoomBtn.disabled = false;
        DOMElements.spectateRoomBtn.disabled = false;

        listenForGameEvents(roomCode);
        listenForChatEvents(roomCode);
        listenForVoiceSignals(roomCode);
        listenForVoicePresence(roomCode, null);
        clearChatMessages();
        appendChatMessage({ isSystem: true, text: `Bạn đang xem phòng #${roomCode} với vai trò Khán Giả` });
        openChatPanel();
    } catch (error) {
        console.error("Failed to spectate room:", error);
        alert("Không thể vào phòng với vai trò Khán Giả. Vui lòng thử lại.");
        DOMElements.spectateRoomBtn.disabled = false;
    }
}

async function spectatorConvertToPlayer() {
    if (!gameState.roomCode || gameState.playerRole !== 'spectator') return;
    const roomRef = database.ref('rooms/' + gameState.roomCode);
    const snap = await roomRef.once('value');
    const roomData = snap.val();
    if (!roomData) return;
    const maxPlayers = roomData.maxPlayers || 2;
    const currentPlayers = Object.keys(roomData.players || {}).length;
    if (currentPlayers >= maxPlayers) {
        alert('Phòng đã đầy người chơi, không thể chuyển sang vai trò chơi.');
        return;
    }
    if (roomData.status === 'playing' || roomData.status === 'finished') {
        alert('Trận đang diễn ra hoặc đã kết thúc, không thể vào chơi giữa chừng.');
        return;
    }

    try {
        const playerData = {
            role: 'guest',
            isReady: false,
            displayName: gameState.user.displayName,
            photoURL: gameState.user.photoURL || null,
            disconnectedAt: null,
        };
        await roomRef.child('players').child(gameState.playerId).set(playerData);
        await roomRef.child('spectators').child(gameState.playerId).remove();
        gameState.playerRole = 'guest';
        appendChatMessage({ isSystem: true, text: 'Bạn đã vào chơi với vai trò người chơi.' });
        if (DOMElements.spectatorJoinPlayBtn) DOMElements.spectatorJoinPlayBtn.classList.add('hidden');
    } catch (error) {
        console.error('Failed to convert spectator:', error);
        alert('Không thể chuyển sang vai trò chơi.');
    }
}

async function handleLeaveRoom() {
    if (!gameState.roomCode || !gameState.playerId) return;
    cancelAutoLeave();

    const roomCode = gameState.roomCode;
    const playerId = gameState.playerId;
    const roomRef = database.ref(`rooms/${roomCode}`);
    const isSpectator = gameState.playerRole === 'spectator';

    try {
        if (isSpectator) {
            const specRef = roomRef.child('spectators').child(playerId);
            await specRef.onDisconnect().cancel();
            await specRef.remove();
            cleanUpAfterLeave(roomCode);
            return;
        }
        const playerRef = roomRef.child('players').child(playerId);
        await playerRef.onDisconnect().cancel();
        await playerRef.remove();

        await roomRef.transaction(roomData => {
            if (!roomData) return roomData;

            const players = roomData.players || {};
            const remainingPlayerIds = Object.keys(players);

            if (remainingPlayerIds.length === 0) {
                return null;
            }

            if (roomData.hostId === playerId) {
                const newHostId = remainingPlayerIds[Math.floor(Math.random() * remainingPlayerIds.length)];
                roomData.hostId = newHostId;

                remainingPlayerIds.forEach(remainingPlayerId => {
                    players[remainingPlayerId].role = remainingPlayerId === newHostId ? 'host' : 'guest';
                });
            }

            if (Array.isArray(roomData.playerOrder)) {
                roomData.playerOrder = roomData.playerOrder.filter(id => id !== playerId);
            }

            if (roomData.turn === playerId) {
                roomData.turn = roomData.playerOrder && roomData.playerOrder.length > 0 ? roomData.playerOrder[0] : null;
                roomData.turnStartedAt = firebase.database.ServerValue.TIMESTAMP;
            }

            return roomData;
        });
    } catch (error) {
        console.error("Error during Firebase cleanup on leave:", error);
    } finally {
        cleanUpAfterLeave(roomCode);
    }
}

function cleanUpAfterLeave(roomCode) {
    cleanupVoice();
    if (roomCode) {
        database.ref('rooms/' + roomCode).off();
        database.ref(`rooms/${roomCode}/chat`).off();
    }
    localStorage.removeItem('activeRoomCode');
    initializeGame(true);
    clearChatMessages();
    closeChatPanel();
    showMultiplayerModal();
}

async function rejoinRoom(roomCode) {
    const roomRef = database.ref('rooms/' + roomCode);
    const snapshot = await roomRef.once('value');

    if (snapshot.exists()) {
        const roomData = snapshot.val();
        const playerInRoom = roomData.players && roomData.players[gameState.playerId];
        const spectatorInRoom = roomData.spectators && roomData.spectators[gameState.playerId];

        if (playerInRoom) {
            console.log("Successfully reconnected to room", roomCode);
            gameState.roomCode = roomCode;
            gameState.playerRole = playerInRoom.role;

            const playerRef = database.ref(`rooms/${roomCode}/players/${gameState.playerId}`);
            playerRef.onDisconnect().update({ disconnectedAt: firebase.database.ServerValue.TIMESTAMP });
            await playerRef.update({ disconnectedAt: null });

            if (roomData.status === 'playing' || roomData.status === 'finished') {
                const savedState = loadState();
                if (savedState) {
                    applyRestoredBoard(savedState);
                }
            }

            listenForGameEvents(roomCode);
            listenForChatEvents(roomCode);
            listenForVoiceSignals(roomCode);
            listenForVoicePresence(roomCode, null);
            clearChatMessages();
            appendChatMessage({ isSystem: true, text: `Bạn đã vào phòng #${roomCode}` });
            openChatPanel();
            hideMultiplayerModal();
        } else if (spectatorInRoom) {
            console.log("Reconnected as spectator to room", roomCode);
            gameState.roomCode = roomCode;
            gameState.playerRole = 'spectator';
            const specRef = database.ref(`rooms/${roomCode}/spectators/${gameState.playerId}`);
            specRef.onDisconnect().update({ disconnectedAt: firebase.database.ServerValue.TIMESTAMP });
            await specRef.update({ disconnectedAt: null });

            listenForGameEvents(roomCode);
            listenForChatEvents(roomCode);
            listenForVoiceSignals(roomCode);
            listenForVoicePresence(roomCode, null);
            clearChatMessages();
            appendChatMessage({ isSystem: true, text: `Bạn đang xem phòng #${roomCode} với vai trò Khán Giả` });
            openChatPanel();
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
        if (player.eliminated) {
            playerEl.classList.add('is-eliminated');
        }

        const avatar = player.photoURL || DEFAULT_AVATAR;
        const displayName = player.displayName || 'Player';
        const skipCount = player.skippedTurns || 0;

        let badges = '';
        if (player.role === 'host') {
            badges += '<span class="host-icon" title="Chủ phòng">👑</span>';
        }
        if (player.eliminated) {
            badges += '<span class="eliminated-badge" title="Đã bị loại">💀</span>';
        } else if (skipCount > 0) {
            badges += `<span class="skip-badge" title="Bỏ lượt ${skipCount}/${MAX_SKIPPED_TURNS}">⏳${skipCount}</span>`;
        }
        badges += `<span class="player-status ${player.isReady ? 'is-ready' : ''}" title="${player.isReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}"></span>`;

        playerEl.innerHTML = `
            <img src="${avatar}" alt="Avatar" class="header-avatar">
            <span class="player-name">${displayName}</span>
            ${badges}
        `;

        DOMElements.playerList.appendChild(playerEl);
    });
}

function renderLobbyPlayerList(players, spectators) {
    if (!DOMElements.lobbyPlayerList) return;
    DOMElements.lobbyPlayerList.innerHTML = '';
    if (!players) return;

    const playersList = Object.values(players).filter(Boolean);
    playersList.forEach(player => {
        const playerEl = document.createElement('div');
        playerEl.className = 'player-item';
        if (player.role === 'host') {
            playerEl.classList.add('is-host');
        }
        if (player.isReady) {
            playerEl.classList.add('is-ready');
        }

        const avatar = player.photoURL || DEFAULT_AVATAR;
        const displayName = player.displayName || 'Player';

        playerEl.innerHTML = `
            <img src="${avatar}" alt="Avatar" class="header-avatar">
            <span class="player-name">${displayName}</span>
            ${player.role === 'host' ? '<span class="host-icon" title="Chủ phòng">👑</span>' : ''}
            ${player.role === 'host' ? '' : `<span class="ready-indicator ${player.isReady ? 'is-active' : ''}" title="${player.isReady ? 'Đã sẵn sàng' : 'Chưa sẵn sàng'}">✓</span>`}
        `;
        DOMElements.lobbyPlayerList.appendChild(playerEl);
    });

    // Render spectators (khán giả)
    const specsList = spectators ? Object.values(spectators).filter(s => s && !s.disconnectedAt) : [];
    specsList.forEach(spec => {
        const el = document.createElement('div');
        el.className = 'player-item is-spectator';
        const avatar = spec.photoURL || DEFAULT_AVATAR;
        const displayName = spec.displayName || 'Khán giả';
        el.innerHTML = `
            <img src="${avatar}" alt="Avatar" class="header-avatar">
            <span class="player-name">${displayName}</span>
            <span class="spectator-icon" title="Khán giả">👁️</span>
        `;
        DOMElements.lobbyPlayerList.appendChild(el);
    });

    if (playersList.length === 1 && playersList[0].role === 'host') {
        DOMElements.waitingForPlayerText.textContent = 'Chờ người chơi khác vào phòng...';
    }
}

async function toggleLobbyReady() {
    if (!gameState.roomCode || !gameState.playerId) return;
    if (gameState.playerRole === 'host') return;

    const playerRef = database.ref(`rooms/${gameState.roomCode}/players/${gameState.playerId}`);
    try {
        const snapshot = await playerRef.once('value');
        const currentReady = !!(snapshot.val() && snapshot.val().isReady);
        const nextReady = !currentReady;
        DOMElements.lobbyReadyBtn.disabled = true;
        updateLobbyReadyButtonUI(nextReady);
        await playerRef.update({ isReady: nextReady });
    } catch (error) {
        console.error('Failed to toggle ready state:', error);
        DOMElements.lobbyReadyBtn.disabled = false;
    }
}

function updateLobbyReadyButtonUI(isReady) {
    if (!DOMElements.lobbyReadyBtn) return;
    DOMElements.lobbyReadyBtn.disabled = false;
    const textEl = DOMElements.lobbyReadyBtn.querySelector('.button-text');
    if (textEl) {
        textEl.textContent = isReady ? '❌ Bỏ Sẵn Sàng' : '✅ Sẵn Sàng';
    } else {
        DOMElements.lobbyReadyBtn.textContent = isReady ? '❌ Bỏ Sẵn Sàng' : '✅ Sẵn Sàng';
    }
    DOMElements.lobbyReadyBtn.classList.toggle('is-ready-active', isReady);
}

async function skipTurn() {
    if (!gameState.roomCode || gameState.playerRole !== 'host') return;

    const roomRef = database.ref('rooms/' + gameState.roomCode);
    roomRef.transaction(roomData => {
        if (roomData && roomData.status === 'playing') {
            const now = Date.now();
            const startMs = toMillis(roomData.turnStartedAt);
            if (startMs && now - startMs < TURN_DURATION * 1000) {
                console.log("Host tried to skip turn, but it was updated recently. Aborting skip.");
                return;
            }

            const players = roomData.players || {};
            const skippedId = roomData.turn;
            if (skippedId && players[skippedId]) {
                players[skippedId].skippedTurns = (players[skippedId].skippedTurns || 0) + 1;
                const skippedCount = players[skippedId].skippedTurns;
                // Ghi log hệ thống vào chat nếu cần thiết (client sẽ tự render)

                // Nếu người chơi bỏ lượt quá nhiều lần → loại khỏi ván chơi
                if (skippedCount >= MAX_SKIPPED_TURNS) {
                    players[skippedId].eliminated = true;
                    players[skippedId].eliminatedAt = firebase.database.ServerValue.TIMESTAMP;
                    if (Array.isArray(roomData.playerOrder)) {
                        roomData.playerOrder = roomData.playerOrder.filter(id => id !== skippedId);
                    }
                    if (roomData.hostId === skippedId && roomData.playerOrder.length > 0) {
                        const newHostId = roomData.playerOrder[Math.floor(Math.random() * roomData.playerOrder.length)];
                        roomData.hostId = newHostId;
                        Object.keys(players).forEach(pid => {
                            if (players[pid] && !players[pid].eliminated) {
                                players[pid].role = pid === newHostId ? 'host' : 'guest';
                            }
                        });
                    }
                    // Lưu log chat (server-side để tất cả client đều thấy khi load)
                    if (typeof roomData.eliminationLog === 'undefined') roomData.eliminationLog = {};
                    roomData.eliminationLog[skippedId] = firebase.database.ServerValue.TIMESTAMP;
                }
            }

            const playerOrder = roomData.playerOrder && roomData.playerOrder.length > 0
                ? roomData.playerOrder
                : Object.keys(players).filter(pid => players[pid] && !players[pid].eliminated);

            if (!playerOrder.length) {
                roomData.turn = null;
                roomData.turnStartedAt = firebase.database.ServerValue.TIMESTAMP;
                return roomData;
            }

            const currentPlayerIndex = playerOrder.indexOf(skippedId);
            let nextPlayerId;
            if (currentPlayerIndex === -1) {
                // Người vừa bị loại; chọn người đầu tiên trong order còn lại
                nextPlayerId = playerOrder[0];
            } else {
                const nextPlayerIndex = (currentPlayerIndex + 1) % playerOrder.length;
                nextPlayerId = playerOrder[nextPlayerIndex];
            }

            roomData.playerOrder = playerOrder;
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
    if (!gameState.playerId) return;
    const players = roomData.players || {};
    const localPlayer = players[gameState.playerId];

    // Người chơi hiện tại đã bị loại
    if (localPlayer && localPlayer.eliminated && roomData.status === 'playing') {
        setTurnStatusText('💀 Bạn đã bị loại vì bỏ lượt quá nhiều lần');
        DOMElements.turnStatusDisplay.classList.remove('hidden');
        DOMElements.turnTimerContainer.classList.add('hidden');
        clearInterval(turnTimerInterval);
        currentTimerKey = null;
        DOMElements.bingoGrid.classList.remove('is-my-turn');
        updateGameLeaveButtonVisibility(roomData);
        return;
    }
    console.log('[turnUI] status=', roomData.status, 'turn=', roomData.turn, 'my=', gameState.playerId, 'role=', gameState.playerRole);

    // --- Xử lý các trạng thái không phải là 'playing' ---
    if (roomData.status !== 'playing') {
        setTurnStatusText('');
        DOMElements.turnStatusDisplay.classList.add('hidden');
        DOMElements.bingoGrid.classList.remove('is-my-turn');
        DOMElements.boardControls.classList.remove('hidden');
        DOMElements.randomFillBtn.disabled = gameState.isBoardLocked;
        DOMElements.lockBoardBtn.disabled = gameState.isBoardLocked;
        clearInterval(turnTimerInterval);
        currentTimerKey = null;
        updateGameLeaveButtonVisibility(roomData);
        return;
    }

    DOMElements.turnStatusDisplay.classList.remove('hidden');
    updateGameLeaveButtonVisibility(roomData);

    // Nếu người chơi cục bộ chưa khóa bảng
    if (!gameState.isBoardLocked) {
        DOMElements.boardControls.classList.remove('hidden');
        DOMElements.randomFillBtn.disabled = false;
        DOMElements.lockBoardBtn.disabled = false;
        setTurnStatusText('Hãy điền và khóa bảng của bạn để sẵn sàng!');
        DOMElements.turnTimerContainer.classList.add('hidden');
        DOMElements.bingoGrid.classList.remove('is-my-turn');
        clearInterval(turnTimerInterval);
        currentTimerKey = null;
        return;
    }

    // Nếu người chơi cục bộ đã khóa bảng, ẩn các nút điều khiển và hiển thị trạng thái
    DOMElements.boardControls.classList.add('hidden');

    const allPlayersReady = Object.values(players).every(p => p.isReady === true);

    // Nếu đang chờ những người chơi khác sẵn sàng
    if (!allPlayersReady) {
        setTurnStatusText('Đang chờ các người chơi khác khóa bảng...');
        DOMElements.turnTimerContainer.classList.add('hidden');
        DOMElements.bingoGrid.classList.remove('is-my-turn');
        clearInterval(turnTimerInterval);
        currentTimerKey = null;
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
        setTurnStatusText('Tất cả đã sẵn sàng! Chuẩn bị bắt đầu...');
        DOMElements.bingoGrid.classList.remove('is-my-turn');
        DOMElements.turnTimerContainer.classList.add('hidden');
        clearInterval(turnTimerInterval);
        currentTimerKey = null;
        return;
    }

    // Lượt chơi đã được thiết lập, tiến hành với thanh thời gian và UI
    const turnStartMs = toMillis(roomData.turnStartedAt);
    const timerKey = roomData.turn ? `turn:${roomData.turn}` : null;

    if (timerKey) {
        DOMElements.turnTimerContainer.classList.remove('hidden');
        if (currentTimerKey !== timerKey) {
            console.log('[timer] new turn timerKey=', timerKey, 'currentTurn=', roomData.turn, 'me=', gameState.playerId);
            currentTimerKey = timerKey;
            clearInterval(turnTimerInterval);

            DOMElements.turnTimerBar.style.transition = 'none';
            DOMElements.turnTimerBar.style.width = '100%';
            requestAnimationFrame(() => {
                DOMElements.turnTimerBar.style.transition = 'width 0.4s linear';
            });

            const thisTurnId = roomData.turn;
            const nowMs = Date.now();
            let turnStartTime;
            if (turnStartMs && (nowMs - turnStartMs) < TURN_DURATION * 1000) {
                turnStartTime = turnStartMs;
            } else {
                turnStartTime = nowMs;
            }
            turnTimerInterval = setInterval(() => {
                const now = Date.now();
                const elapsed = (now - turnStartTime) / 1000;
                const remaining = Math.max(0, TURN_DURATION - elapsed);
                const percentage = (remaining / TURN_DURATION) * 100;
                console.log('[tick] elapsed=' + elapsed.toFixed(1) + 's remaining=' + remaining.toFixed(1) + 's width=' + percentage.toFixed(0) + '%');
                DOMElements.turnTimerBar.style.width = `${percentage}%`;

                if (remaining <= 0) {
                    clearInterval(turnTimerInterval);
                    currentTimerKey = null;
                    if (!gameState.isGameOver && gameState.playerRole === 'host') {
                        skipTurn();
                    }
                }
            }, 500);
        }
    } else {
        DOMElements.turnTimerContainer.classList.add('hidden');
        clearInterval(turnTimerInterval);
        currentTimerKey = null;
    }

    const currentTurnPlayerId = roomData.turn;
    gameState.currentTurnPlayerId = currentTurnPlayerId;

    if (currentTurnPlayerId === gameState.playerId) {
        setTurnStatusText('✨ Đến lượt bạn chọn một số! ✨');
        DOMElements.bingoGrid.classList.add('is-my-turn');
    } else if (currentTurnPlayerId) {
        const currentPlayer = roomData.players[currentTurnPlayerId];
        const currentTurnPlayerName = currentPlayer ? currentPlayer.displayName : 'Đối thủ';
        setTurnStatusText(`⏳ Đang chờ ${currentTurnPlayerName} chọn...`);
        DOMElements.bingoGrid.classList.remove('is-my-turn');
    } else {
        DOMElements.bingoGrid.classList.remove('is-my-turn');
    }
}

function listenForGameEvents(roomCode) {
    const roomRef = database.ref('rooms/' + roomCode);
    roomRef.off();
    let eventCount = 0;
    roomRef.on('value', (snapshot) => {
        eventCount += 1;
        const roomData = snapshot.val();
        console.log('[listen] event#' + eventCount, 'status=', roomData && roomData.status, 'turn=', roomData && roomData.turn, 'turnStartedAt=', roomData && roomData.turnStartedAt);
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
                const name = newPlayer.displayName || 'Người chơi';
                appendChatMessage({ isSystem: true, text: `${name} đã vào phòng` });
            }
        }
        // Detect player leave
        if (gameState.knownPlayerIds.size > 0) {
            for (const id of gameState.knownPlayerIds) {
                if (!currentPlayerIds.has(id) && id !== gameState.playerId) {
                    // Người rời được xử lý qua transaction; tin nhắn này chỉ phát cho client khi đã có dữ liệu
                }
            }
        }
        gameState.knownPlayerIds = currentPlayerIds;

        // Phát thông báo khi người chơi bị loại do bỏ lượt
        if (roomData.eliminationLog) {
            const logEntries = Object.entries(roomData.eliminationLog);
            logEntries.forEach(([eliminatedId, tsValue]) => {
                const ts = toMillis(tsValue);
                const seen = gameState.notifiedEliminations && gameState.notifiedEliminations.has(eliminatedId);
                if (seen) return;
                if (!gameState.notifiedEliminations) gameState.notifiedEliminations = new Set();
                gameState.notifiedEliminations.add(eliminatedId);
                const eliminatedPlayer = players[eliminatedId];
                const name = eliminatedPlayer ? (eliminatedPlayer.displayName || 'Người chơi') : 'Người chơi';
                appendChatMessage({
                    isSystem: true,
                    text: `💀 ${name} đã bị loại do bỏ lượt ${MAX_SKIPPED_TURNS} lần`,
                    at: ts,
                });
            });
        }

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
            saveState();
        }

        // Update in-game UI
        if (gameState.roomCode) {
            DOMElements.gameRoomInfo.classList.remove('hidden');
            DOMElements.gameRoomCode.textContent = gameState.roomCode;
            DOMElements.playerListContainer.classList.remove('hidden');
            renderPlayerList(players);
            // Refresh danh sách người đang nói (tên/avatar) khi players thay đổi
            if (DOMElements.voiceParticipants && gameState.roomCode) {
                const ref = database.ref(`rooms/${gameState.roomCode}/voice`);
                ref.once('value', (snap) => {
                    const data = snap.val() || {};
                    const speakers = [];
                    Object.entries(data).forEach(([peerId, info]) => {
                        const presence = info && info._presence && info._presence[peerId];
                        if (presence && presence.micOn) speakers.push(peerId);
                    });
                    renderVoiceParticipants(speakers, players);
                });
            }
        }

        // Update Lobby UI
        if (DOMElements.mainModal.classList.contains('visible') && (roomData.status === 'waiting' || roomData.status === 'playing')) {
            renderLobbyPlayerList(players, roomData.spectators);
            const memberEntries = Object.values(players).filter(p => p && p.role !== 'host');
            const memberTotal = memberEntries.length;
            const memberReady = memberEntries.filter(p => p.isReady).length;
            if (memberTotal === 0) {
                DOMElements.waitingForPlayerText.textContent = `Đang chờ người chơi sẵn sàng (0/0)`;
            } else {
                DOMElements.waitingForPlayerText.textContent = `Đang chờ người chơi sẵn sàng (${memberReady}/${memberTotal})`;
            }

            if (gameState.playerRole === 'spectator') {
                DOMElements.startGameBtn.classList.add('hidden');
                DOMElements.lobbyReadyBtn.classList.add('hidden');
                if (DOMElements.spectatorJoinPlayBtn) {
                    const localSpectator = (roomData.spectators || {})[gameState.playerId];
                    const localActivePlayer = !!players[gameState.playerId];
                    if (localSpectator && !localActivePlayer && roomData.status === 'waiting') {
                        const maxPlayers = roomData.maxPlayers || 2;
                        const canConvert = memberTotal < maxPlayers;
                        DOMElements.spectatorJoinPlayBtn.classList.remove('hidden');
                        DOMElements.spectatorJoinPlayBtn.disabled = !canConvert;
                        DOMElements.spectatorJoinPlayBtn.title = canConvert ? 'Vào chơi với vai trò người chơi' : 'Phòng đã đầy';
                    } else {
                        DOMElements.spectatorJoinPlayBtn.classList.add('hidden');
                    }
                }
                if (DOMElements.waitingForPlayerText) {
                    DOMElements.waitingForPlayerText.textContent = `👁️ Bạn đang xem (${memberReady}/${memberTotal} sẵn sàng)`;
                }
            } else if (gameState.playerRole === 'host') {
                DOMElements.startGameBtn.classList.remove('hidden');
                const allMembersReady = memberTotal >= 1 && memberReady === memberTotal;
                const hasEnoughPlayers = playerCount >= 2;
                const canStart = allMembersReady && hasEnoughPlayers;
                DOMElements.startGameBtn.disabled = !canStart;
                DOMElements.startGameBtn.title = canStart
                    ? 'Bắt đầu trận đấu'
                    : (!hasEnoughPlayers
                        ? 'Cần ít nhất 2 người chơi trong phòng.'
                        : 'Chờ tất cả thành viên nhấn Sẵn Sàng.');
                DOMElements.lobbyReadyBtn.classList.add('hidden');
                if (DOMElements.spectatorJoinPlayBtn) DOMElements.spectatorJoinPlayBtn.classList.add('hidden');
            } else {
                DOMElements.startGameBtn.classList.add('hidden');
                DOMElements.startGameBtn.disabled = true;
                const localPlayer = players[gameState.playerId];
                const isReady = !!(localPlayer && localPlayer.isReady);
                DOMElements.lobbyReadyBtn.classList.remove('hidden');
                DOMElements.lobbyReadyBtn.disabled = false;
                updateLobbyReadyButtonUI(isReady);
                if (DOMElements.spectatorJoinPlayBtn) DOMElements.spectatorJoinPlayBtn.classList.add('hidden');
            }
        }

        if (!DOMElements.roomInfoDisplay.classList.contains('hidden')) {
            const memberEntries = Object.values(players).filter(p => p && p.role !== 'host');
            const memberTotal = memberEntries.length;
            const memberReady = memberEntries.filter(p => p.isReady).length;
            if (memberTotal === 0) {
                DOMElements.waitingForPlayerText.textContent = `Đang chờ người chơi sẵn sàng (0/0)`;
            } else {
                DOMElements.waitingForPlayerText.textContent = `Đang chờ người chơi sẵn sàng (${memberReady}/${memberTotal})`;
            }
        }

        updateTurnUI(roomData);

        // Nếu chỉ còn 1 người chơi chưa bị loại → người đó thắng
        const activePlayers = Object.values(players).filter(p => p && !p.eliminated);
        if (roomData.status === 'playing' && activePlayers.length === 1 && !roomData.winner && !gameState.isGameOver) {
            const soleWinner = activePlayers[0];
            const roomRefSolo = database.ref('rooms/' + roomCode);
            roomRefSolo.child('status').set('finished').catch(() => {});
            roomRefSolo.update({
                status: 'finished',
                lastWinnerId: soleWinner.uid || soleWinner.id || null,
                lastWinnerName: soleWinner.displayName,
                winner: {
                    playerId: soleWinner.uid || soleWinner.id || null,
                    displayName: soleWinner.displayName,
                },
            }).catch(() => {});
        }

        // Handle Game Over
        if (roomData.status === 'finished' && roomData.winner && !DOMElements.victoryModal.classList.contains('visible')) {
            gameState.isGameOver = true;
            gameState.lastWinnerId = roomData.winner.playerId;
            gameState.lastWinnerName = roomData.winner.displayName;
            try {
                localStorage.setItem('lastWinnerId', roomData.winner.playerId || '');
                localStorage.setItem('lastWinnerName', roomData.winner.displayName || '');
            } catch (e) {
                console.error('Failed to persist last winner:', e);
            }
            DOMElements.bingoGrid.classList.add('locked');
            DOMElements.turnStatusDisplay.classList.add('hidden');
            clearInterval(turnTimerInterval);

            if (roomData.winner.playerId === gameState.playerId) {
                showVictoryModal(true, roomData.winner.displayName);
            } else {
                showVictoryModal(false, roomData.winner.displayName);
            }
        }

        if (roomData.status === 'playing' && DOMElements.mainModal.classList.contains('visible')) {
            hideMultiplayerModal();
        }

        const aloneCheck = players[gameState.playerId];
        const isHostLocal = gameState.playerRole === 'host';
        const onlyHostAlone = isHostLocal
            && roomData.status === 'playing'
            && playerCount === 1
            && aloneCheck
            && !aloneCheck.isReady
            && !gameState.isBoardLocked
            && !gameState.isGameOver;

        if (onlyHostAlone) {
            console.log('Host is alone in a fresh game, returning to lobby.');
            hostReturnToLobby();
        }
    });
}

function updateGameLeaveButtonVisibility(roomData) {
    if (DOMElements.leaveRoomBtn) {
        // Hiện nút rời phòng trong game khi chưa khóa bảng và chưa game over
        const shouldShow = !gameState.isBoardLocked && !gameState.isGameOver;
        DOMElements.leaveRoomBtn.classList.toggle('hidden', !shouldShow);
    }
    if (DOMElements.lobbyLeaveRoomBtn) {
        // Nút rời phòng ở sảnh: luôn hiện (kể cả khi đang playing, vì trước khóa bảng vẫn có thể thoát)
        const lobbyShouldShow = true;
        DOMElements.lobbyLeaveRoomBtn.classList.toggle('hidden', !lobbyShouldShow);
    }
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
        updateGameLeaveButtonVisibility({ status: 'playing' });
        saveState();

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
    if (!gameState.isBoardLocked || gameState.isGameOver || gameState.playerRole === 'spectator' || gameState.playerId !== gameState.currentTurnPlayerId) {
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

async function hostReturnToLobby() {
    if (!gameState.roomCode || gameState.playerRole !== 'host') return;

    const roomRef = database.ref('rooms/' + gameState.roomCode);
    const snapshot = await roomRef.once('value');
    const roomData = snapshot.val();
    if (!roomData || roomData.status !== 'playing') return;

    const playerUpdates = {};
    Object.keys(roomData.players || {}).forEach(pid => {
        playerUpdates[`/players/${pid}/isReady`] = false;
    });
    await roomRef.update(playerUpdates);

    await roomRef.update({
        status: 'waiting',
        calledNumbers: {},
        turn: null,
        turnStartedAt: null,
        playerOrder: null,
    });
    localStorage.removeItem(STORAGE_KEY);
    resetClientForLobby();
}

function resetClientForLobby() {
    gameState.bingoBoard.fill(null);
    gameState.selectedCells.fill(false);
    gameState.calledNumbers.clear();
    gameState.isBoardLocked = false;
    gameState.linesCompleted.clear();
    gameState.totalLinesCompleted = 0;
    gameState.isGameOver = false;

    renderBingoGrid();
    updateCallerDisplay();
    updateLinesCompletedDisplay();
    DOMElements.bingoLinesSVG.innerHTML = '';
    DOMElements.bingoGrid.classList.remove('bingo-victory');
    DOMElements.randomFillBtn.disabled = false;
    DOMElements.lockBoardBtn.disabled = false;
    DOMElements.lockBoardBtn.querySelector('.button-text').textContent = '🔒 Khóa Bảng & Bắt Đầu';
    DOMElements.currentCalledNumber.textContent = '?';
    DOMElements.boardControls.classList.remove('hidden');
    DOMElements.turnStatusDisplay.classList.add('hidden');
    DOMElements.gameContainer.classList.add('hidden');
    DOMElements.mainModal.classList.add('visible');
    DOMElements.authView.classList.add('hidden');
    DOMElements.lobbyView.classList.remove('hidden');
    DOMElements.roomActions.classList.add('hidden');
    DOMElements.roomInfoDisplay.classList.remove('hidden');
    if (gameState.roomCode) {
        DOMElements.roomCodeDisplay.textContent = gameState.roomCode;
    }
    updateGameLeaveButtonVisibility({ status: 'waiting' });
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
        lastWinnerId: roomData.winner ? roomData.winner.playerId : roomData.lastWinnerId || null,
        lastWinnerName: roomData.winner ? roomData.winner.displayName : roomData.lastWinnerName || null,
        winner: null,
        calledNumbers: {},
        turn: null,
        turnStartedAt: null,
    });
    localStorage.removeItem(STORAGE_KEY);
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

    if (playerIds.length > 5) {
        alert("Phòng chỉ hỗ trợ tối đa 5 người chơi.");
        return;
    }

    const memberIds = playerIds.filter(pid => players[pid] && players[pid].role !== 'host');
    const readyMemberCount = memberIds.filter(pid => players[pid].isReady).length;
    if (memberIds.length === 0 || readyMemberCount !== memberIds.length) {
        alert("Vui lòng chờ tất cả thành viên nhấn Sẵn Sàng trước khi bắt đầu.");
        return;
    }

    // Reset trạng thái isReady cho tất cả người chơi cho vòng mới
    const playerUpdates = {};
    playerIds.forEach(pid => {
        playerUpdates[`/players/${pid}/isReady`] = false;
    });
    await roomRef.update(playerUpdates);

    const hostId = roomData.hostId || gameState.playerId;
    const firstPlayerId = roomData.lastWinnerId && playerIds.includes(roomData.lastWinnerId)
        ? roomData.lastWinnerId
        : hostId;
    const playerOrder = [
        firstPlayerId,
        ...playerIds.filter(playerId => playerId !== firstPlayerId)
    ];

    const updates = {
        status: 'playing', // Trò chơi bắt đầu, người chơi thấy bảng
        playerOrder: playerOrder,
        turn: firstPlayerId,
        turnStartedAt: firebase.database.ServerValue.TIMESTAMP,
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
    saveState();

    if (gameState.totalLinesCompleted >= BINGO_SIZE && !gameState.isGameOver) {
        gameState.isGameOver = true;
        saveState();
        const roomRef = database.ref('rooms/' + gameState.roomCode);
        roomRef.update({
            status: 'finished',
            lastWinnerId: gameState.playerId,
            lastWinnerName: gameState.user.displayName,
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
if (DOMElements.spectateRoomBtn) {
    DOMElements.spectateRoomBtn.addEventListener('click', spectateRoom);
}
if (DOMElements.spectatorJoinPlayBtn) {
    DOMElements.spectatorJoinPlayBtn.addEventListener('click', spectatorConvertToPlayer);
}
DOMElements.leaveRoomBtn.addEventListener('click', () => {
    // Confirm trước khi rời phòng giữa trận
    if (gameState.roomCode && (gameState.isBoardLocked || gameState.isGameOver)) {
        if (!confirm('Bạn có chắc muốn rời phòng? Tiến trình hiện tại sẽ bị mất.')) return;
    }
    handleLeaveRoom();
});
DOMElements.victoryLeaveRoomBtn.addEventListener('click', () => {
    cancelAutoLeave();
    hideVictoryModal();
    handleLeaveRoom();
});
DOMElements.lobbyLeaveRoomBtn.addEventListener('click', handleLeaveRoom);
DOMElements.startGameBtn.addEventListener('click', handleStartGameClick);
DOMElements.lobbyReadyBtn.addEventListener('click', toggleLobbyReady);
DOMElements.closeProfileModalBtn.addEventListener('click', closeProfileModal);
DOMElements.lockBoardBtn.addEventListener('click', validateAndLockBoard);

if (DOMElements.chatToggleBtn) {
    DOMElements.chatToggleBtn.addEventListener('click', toggleChatPanel);
}
if (DOMElements.chatForm) {
    DOMElements.chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = DOMElements.chatInput ? DOMElements.chatInput.value : '';
        if (sendChatMessage(text)) {
            DOMElements.chatInput.value = '';
        }
        toggleChatEmojiPopup(false);
        if (DOMElements.chatInput) DOMElements.chatInput.focus();
    });
}
if (DOMElements.chatInput) {
    DOMElements.chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            DOMElements.chatForm.requestSubmit();
        }
    });
    DOMElements.chatInput.addEventListener('focus', () => toggleChatEmojiPopup(false));
}
if (DOMElements.chatEmojiBtn) {
    DOMElements.chatEmojiBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleChatEmojiPopup();
    });
}
if (DOMElements.chatVoiceBtn) {
    DOMElements.chatVoiceBtn.addEventListener('click', () => {
        toggleMicrophone();
    });
}
document.querySelectorAll('#chat-emoji-popup .emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!DOMElements.chatInput) return;
        DOMElements.chatInput.value += btn.textContent;
        DOMElements.chatInput.focus();
        toggleChatEmojiPopup(false);
    });
});
document.addEventListener('click', (event) => {
    if (!DOMElements.chatEmojiPopup || DOMElements.chatEmojiPopup.classList.contains('hidden')) return;
    const target = event.target;
    if (DOMElements.chatEmojiPopup.contains(target)) return;
    if (DOMElements.chatEmojiBtn && DOMElements.chatEmojiBtn.contains(target)) return;
    toggleChatEmojiPopup(false);
});
DOMElements.resetGameBtn.addEventListener('click', () => {
    if (gameState.playerRole !== 'host') return;

    DOMElements.resetGameBtn.disabled = true;
    handleNewRoundByHost().catch(error => {
        console.error('Failed to start new round:', error);
        DOMElements.resetGameBtn.disabled = false;
        alert('Không thể bắt đầu ván mới. Vui lòng thử lại.');
    });
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
if (DOMElements.openFriendsBtn) {
    DOMElements.openFriendsBtn.addEventListener('click', () => {
        openFriendsModal();
        DOMElements.userDropdown.classList.add('hidden');
    });
}
if (DOMElements.closeFriendsModalBtn) {
    DOMElements.closeFriendsModalBtn.addEventListener('click', closeFriendsModal);
}
if (DOMElements.friendsTabs) {
    DOMElements.friendsTabs.forEach(tab => {
        tab.addEventListener('click', () => switchFriendsTab(tab.dataset.tab));
    });
}
if (DOMElements.friendSearchBtn) {
    DOMElements.friendSearchBtn.addEventListener('click', async () => {
        const q = DOMElements.friendSearchInput ? DOMElements.friendSearchInput.value : '';
        if (!q.trim()) return;
        const results = await searchUsersByName(q);
        DOMElements.friendSearchResults.innerHTML = '';
        if (results.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'friend-hint';
            hint.textContent = 'Không tìm thấy người chơi nào.';
            DOMElements.friendSearchResults.appendChild(hint);
            return;
        }
        results.forEach(user => {
            const item = document.createElement('div');
            item.className = 'friend-item';
            item.innerHTML = `
                <img src="${user.photoURL || DEFAULT_AVATAR}" alt="">
                <span class="friend-name">${user.displayName || 'Người chơi'}</span>
                <div class="friend-actions">
                    <button class="mini-btn add-friend-result-btn" data-uid="${user.uid}">➕ Kết bạn</button>
                </div>
            `;
            DOMElements.friendSearchResults.appendChild(item);
        });
        DOMElements.friendSearchResults.querySelectorAll('.add-friend-result-btn').forEach(btn => {
            btn.addEventListener('click', () => sendFriendInvite(btn.dataset.uid));
        });
    });
}
if (DOMElements.addFriendBtn) {
    DOMElements.addFriendBtn.addEventListener('click', async () => {
        const name = DOMElements.addFriendInput ? DOMElements.addFriendInput.value.trim() : '';
        if (!name) {
            DOMElements.addFriendResult.textContent = 'Vui lòng nhập tên hiển thị.';
            return;
        }
        const results = await searchUsersByName(name);
        if (results.length === 0) {
            DOMElements.addFriendResult.textContent = 'Không tìm thấy người chơi với tên này.';
            return;
        }
        const exact = results.find(r => (r.displayName || '').toLowerCase() === name.toLowerCase()) || results[0];
        await sendFriendInvite(exact.uid);
        DOMElements.addFriendResult.textContent = `Đã gửi lời mời đến ${exact.displayName}.`;
        DOMElements.addFriendInput.value = '';
    });
}
async function performLogout() {
    // Rời phòng hiện tại nếu đang trong phòng
    if (gameState.roomCode && gameState.playerId) {
        try {
            await handleLeaveRoom();
        } catch (e) {
            console.error('Error leaving room before logout:', e);
        }
    }
    cancelAutoLeave();
    try {
        const myUid = gameState.playerId;
        if (myUid) {
            await database.ref(`users/${myUid}/status`).set({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
        }
    } catch (e) {
        console.error('Failed to set offline status:', e);
    }
    try {
        await auth.signOut();
    } catch (e) {
        console.error('Failed to sign out:', e);
    }
}

DOMElements.logoutBtn.addEventListener('click', performLogout);
if (DOMElements.lobbyLogoutBtn) {
    DOMElements.lobbyLogoutBtn.addEventListener('click', performLogout);
}
if (DOMElements.preRoomLogoutBtn) {
    DOMElements.preRoomLogoutBtn.addEventListener('click', performLogout);
}
if (DOMElements.gameLogoutBtn) {
    DOMElements.gameLogoutBtn.addEventListener('click', performLogout);
}

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

        setupUserProfile();

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
        // Note: initializeGame(true) is called once after auth change completes;
        // rejoinRoom handles applyRestoredBoard internally to restore locked board state.
    } else {
        console.log("User signed out.");
        teardownUserProfile();
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
