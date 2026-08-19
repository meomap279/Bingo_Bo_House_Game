// app.js - Main Application Logic

// --- 1. State Management ---
const gameState = {
    bingoBoard: Array(25).fill(null), // Stores numbers 1-25
    selectedCells: Array(25).fill(false), // True if cell is marked
    calledNumbers: new Set(), // Numbers already called by the host
    isBoardLocked: false,
    linesCompleted: new Set(), // Stores indices of completed lines (0-11)
    totalLinesCompleted: 0,
    isGameOver: false,
    isMuted: false,
    theme: 'cyan', // Default theme
};

// --- 2. Constants & DOM Elements ---
const BINGO_SIZE = 5;
const TOTAL_CELLS = BINGO_SIZE * BINGO_SIZE;
const MIN_NUMBER = 1;
const MAX_NUMBER = 25;

const DOMElements = {
    bingoGrid: document.getElementById('bingo-grid'),
    newGameBtn: document.getElementById('new-game-btn'),
    randomFillBtn: document.getElementById('random-fill-btn'),
    lockBoardBtn: document.getElementById('lock-board-btn'),
    callNumberBtn: document.getElementById('call-number-btn'),
    currentCalledNumber: document.getElementById('current-called-number'),
    calledNumberSphere: document.getElementById('called-number-sphere'),
    calledCount: document.getElementById('called-count'),
    calledNumbersHistory: document.getElementById('called-numbers-history'),
    linesCompletedCount: document.getElementById('lines-completed-count'),
    bingoLinesSVG: document.getElementById('bingo-lines-svg'),
    victoryModal: document.getElementById('victory-modal'),
    resetGameBtn: document.getElementById('reset-game-btn'),
    toggleSoundBtn: document.getElementById('toggle-sound-btn'),
    themeSelector: document.querySelector('.theme-selector'),
    linesCompletedCountText: document.getElementById('lines-completed-count-text'),
    linesProgressBar: document.getElementById('lines-progress-bar'),
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
        // Cancel any pending audio param changes and set the value immediately.
        // This is more robust than setTargetAtTime when dealing with a context that might be suspended.
        const now = this.audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        const targetVolume = isMuted ? 0 : this.masterVolume;
        // Use a very short ramp to avoid clicks but apply the change quickly and robustly.
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
        this._playTone(880, 0.1, 'sine', 0.005, 0.05, 0.8, 0.05); // High frequency, short pop
        this._playTone(1320, 0.1, 'sine', 0.005, 0.05, 0.6, 0.05); // Higher harmonic
    }

    playLaserSound() {
        const startTime = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(400, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, startTime + 0.3); // Swoosh up
        oscillator.frequency.exponentialRampToValueAtTime(200, startTime + 0.6); // Swoosh down

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

// New functions for Local Storage
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
        // Re-hydrate Sets from arrays
        return {
            ...savedState,
            calledNumbers: new Set(savedState.calledNumbers),
            linesCompleted: new Set(savedState.linesCompleted),
        };
    } catch (e) {
        console.error("Failed to load game state:", e);
        localStorage.removeItem(STORAGE_KEY); // Clear corrupted data
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

    // The original JS for the ripple effect did not match the CSS.
    // This corrected version adds the 'animate' class to the button itself,
    // which is what the CSS in style.css expects to trigger the ::after pseudo-element.
    button.classList.add('animate');

    // Remove the class after the animation duration (0.7s from CSS transition)
    // so the animation can be re-triggered on subsequent clicks.
    setTimeout(() => {
        button.classList.remove('animate');
    }, 700);
}

// --- 5. UI Rendering & Updates ---

function renderBingoGrid() {
    DOMElements.bingoGrid.innerHTML = ''; // Clear existing grid
    for (let i = 0; i < TOTAL_CELLS; i++) {
        const cell = document.createElement('div');
        cell.classList.add('bingo-cell');
        cell.dataset.index = i;

        const input = document.createElement('input');
        input.type = 'number';
        input.min = MIN_NUMBER;
        input.max = MAX_NUMBER;
        input.value = gameState.bingoBoard[i] || '';
        input.maxLength = 2; // Max 2 digits for numbers 1-25
        input.readOnly = gameState.isBoardLocked; // Lock input if board is locked

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

    // Update history
    DOMElements.calledNumbersHistory.innerHTML = '';
    Array.from(gameState.calledNumbers).sort((a, b) => a - b).forEach(num => {
        const chip = document.createElement('span');
        chip.classList.add('history-chip');
        chip.textContent = num;
        DOMElements.calledNumbersHistory.appendChild(chip);
    });
    // Auto-scroll to bottom
    DOMElements.calledNumbersHistory.scrollTop = DOMElements.calledNumbersHistory.scrollHeight;

    // Animate sphere
    DOMElements.calledNumberSphere.classList.remove('pop-bounce');
    void DOMElements.calledNumberSphere.offsetWidth; // Trigger reflow
    DOMElements.calledNumberSphere.classList.add('pop-bounce');
}

function updateSoundButtonUI() {
    DOMElements.toggleSoundBtn.textContent = gameState.isMuted ? '🔇' : '🔊';
}

function updateLinesCompletedDisplay() {
    const maxLines = WINNING_LINES.length; // Max 12 lines
    DOMElements.linesCompletedCountText.textContent = gameState.totalLinesCompleted;
    const progressPercentage = (gameState.totalLinesCompleted / maxLines) * 100;
    DOMElements.linesProgressBar.style.width = `${progressPercentage}%`;
}

function showVictoryModal() {
    DOMElements.victoryModal.classList.add('visible');
    // Trigger confetti
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
        // since particles fall down, start a bit higher than random
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

function hideVictoryModal() {
    DOMElements.victoryModal.classList.remove('visible');
}

// --- 6. Game Logic ---

function initializeGame(forceReset = false) {
    // Try to load game from storage unless a reset is forced
    if (!forceReset) {
        const loadedState = loadState();
        if (loadedState) {
            Object.assign(gameState, loadedState);

            // Re-render UI based on loaded state
            applyTheme(gameState.theme);
            audioManager.setMute(gameState.isMuted);
            updateSoundButtonUI();
            renderBingoGrid();
            updateCallerDisplay();
            // checkWinConditions will update line count and redraw lines/styles
            // Pass true to suppress sounds on initial load
            checkWinConditions(true);

            // Set button states based on loaded state
            DOMElements.randomFillBtn.disabled = gameState.isBoardLocked;
            DOMElements.lockBoardBtn.disabled = gameState.isBoardLocked;
            DOMElements.callNumberBtn.disabled = !gameState.isBoardLocked || gameState.isGameOver;

            // The checkWinConditions call will handle showing the modal if game is over.
            return; // Exit initialization, we've loaded a game
        }
    }

    // This part runs for a new game or a forced reset
    localStorage.removeItem(STORAGE_KEY);

    // Reset state object
    gameState.bingoBoard.fill(null);
    gameState.selectedCells.fill(false);
    gameState.calledNumbers.clear();
    gameState.isBoardLocked = false;
    gameState.linesCompleted.clear();
    gameState.totalLinesCompleted = 0;
    gameState.isGameOver = false;
    // User's theme & mute preference should persist across game resets.
    // User's mute preference should persist across game resets, so we don't reset it here.

    // Reset UI
    renderBingoGrid();
    updateCallerDisplay();
    updateLinesCompletedDisplay();
    hideVictoryModal();
    DOMElements.bingoLinesSVG.innerHTML = ''; // Clear SVG lines
    DOMElements.bingoGrid.classList.remove('bingo-victory');

    applyTheme(gameState.theme);
    // Update sound UI based on potentially persistent mute state
    updateSoundButtonUI();

    // Enable board setup buttons, disable caller button
    DOMElements.randomFillBtn.disabled = false;
    DOMElements.lockBoardBtn.disabled = false;
    DOMElements.callNumberBtn.disabled = true;
    DOMElements.currentCalledNumber.textContent = '?';
}

function fillBoardRandomly() {
    if (gameState.isBoardLocked) return;

    const numbers = Array.from({ length: MAX_NUMBER }, (_, i) => i + MIN_NUMBER); // [1, 2, ..., 25]
    shuffleArray(numbers);
    gameState.bingoBoard = numbers.slice(0, TOTAL_CELLS);
    renderBingoGrid();
}

function validateAndLockBoard() {
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
        isValid = false; // Ensure all 25 cells are filled
    }

    if (isValid) {
        gameState.isBoardLocked = true;
        renderBingoGrid(); // Re-render to apply 'locked' class to inputs
        DOMElements.randomFillBtn.disabled = true;
        DOMElements.lockBoardBtn.disabled = true;
        DOMElements.callNumberBtn.disabled = false;
        saveState(); // Save state after locking the board
        alert('Bảng BINGO đã được khóa! Bắt đầu quay số.');
    } else {
        alert('Vui lòng điền đủ 25 số duy nhất từ 1-25 vào bảng.');
    }
}

function callNextNumber() {
    if (!gameState.isBoardLocked || gameState.isGameOver) return;

    // Tạo một tập hợp tất cả các số không khả dụng để quay.
    // Bao gồm các số đã được quay trước đó VÀ các số người chơi đã tự chọn trên bảng.
    const unavailableNumbers = new Set(gameState.calledNumbers);
    gameState.selectedCells.forEach((isSelected, index) => {
        if (isSelected) {
            unavailableNumbers.add(gameState.bingoBoard[index]);
        }
    });

    const availableNumbers = Array.from({ length: MAX_NUMBER }, (_, i) => i + MIN_NUMBER)
        .filter(num => !unavailableNumbers.has(num));

    if (availableNumbers.length === 0) {
        alert('Đã gọi hết tất cả các số! Trò chơi kết thúc.');
        DOMElements.callNumberBtn.disabled = true;
        return;
    }

    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    const calledNum = availableNumbers[randomIndex];
    gameState.calledNumbers.add(calledNum);

    audioManager.playPopSound(); // Play sound for calling number
    updateCallerDisplay();
    checkBoardForCalledNumber(calledNum);
    saveState(); // Save state after a new number is called
}

function checkBoardForCalledNumber(calledNum) {
    gameState.bingoBoard.forEach((boardNum, index) => {
        if (boardNum === calledNum) {
            toggleCellSelection(index, true); // Mark as selected if it matches a called number
        }
    });
}

function toggleCellSelection(index, fromCaller = false) {
    if (!gameState.isBoardLocked || gameState.isGameOver) return;

    const cellElement = DOMElements.bingoGrid.children[index];
    const cellNumber = gameState.bingoBoard[index];

    gameState.selectedCells[index] = !gameState.selectedCells[index];

    if (gameState.selectedCells[index]) {
        cellElement.classList.add('selected');
        audioManager.playPopSound();
    } else {
        cellElement.classList.remove('selected');
    }

    checkWinConditions();
    saveState(); // Save state after a cell is toggled
}

function checkWinConditions(isInitialLoad = false) {
    if (gameState.isGameOver) return;

    // Clear previous SVG lines and cell stylings to handle state changes (like un-selecting a cell)
    // Use `userSpaceOnUse` for the gradient to ensure it's applied consistently
    // across the entire SVG canvas, fixing issues with horizontal/vertical lines.
    DOMElements.bingoLinesSVG.innerHTML = `
        <defs>
            <linearGradient id="laserGradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="500" y2="500">
                <stop offset="0%" stop-color="var(--theme-primary)"/>
                <stop offset="50%" stop-color="var(--theme-secondary)"/>
                <stop offset="100%" stop-color="var(--theme-primary)"/>
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
            // Add to the set of currently completed lines
            gameState.linesCompleted.add(lineIndex);

            // Draw the laser line for this completed line
            drawLaserLine(line);

            // Apply the 'completed-line' (red) style to the cells
            line.forEach(cellIndex => {
                const cellElement = DOMElements.bingoGrid.children[cellIndex];
                if (cellElement) {
                    cellElement.classList.add('completed-line');
                }
            });

            // If it's a newly completed line (and not loading), play the sound
            if (!previouslyCompleted.has(lineIndex) && !isInitialLoad) {
                audioManager.playLaserSound();
            }
        }
    });

    gameState.totalLinesCompleted = gameState.linesCompleted.size;
    updateLinesCompletedDisplay();

    if (gameState.totalLinesCompleted >= BINGO_SIZE) { // 5 lines for BINGO!
        gameState.isGameOver = true;
        DOMElements.callNumberBtn.disabled = true;
        // Disable further cell clicks
        DOMElements.bingoGrid.classList.add('locked');
        DOMElements.bingoGrid.classList.add('bingo-victory');

        if (!isInitialLoad) {
            audioManager.playVictoryFanfare();
        }
        showVictoryModal();
    }
}

function drawLaserLine(lineIndices) {
    const svg = DOMElements.bingoLinesSVG;
    // The SVG has a fixed viewBox of "0 0 500 500".
    // All calculations must be done within this coordinate system,
    // regardless of the actual display size of the grid.
    const VIRTUAL_GRID_SIZE = 500;
    const cellSize = VIRTUAL_GRID_SIZE / BINGO_SIZE;
    // Calculate start and end points of the line
    const startCellIndex = lineIndices[0];
    const endCellIndex = lineIndices[BINGO_SIZE - 1];

    const startRow = Math.floor(startCellIndex / BINGO_SIZE);
    const startCol = startCellIndex % BINGO_SIZE;
    const endRow = Math.floor(endCellIndex / BINGO_SIZE);
    const endCol = endCellIndex % BINGO_SIZE;

    // Center of the start cell
    const x1 = startCol * cellSize + cellSize / 2;
    const y1 = startRow * cellSize + cellSize / 2;

    // Center of the end cell
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

// --- 7. Event Listeners ---
function addGridEventListeners() {
    const inputs = DOMElements.bingoGrid.querySelectorAll('.bingo-cell input');
    inputs.forEach((input, index) => {
        // Input handling for manual board setup
        input.oninput = (event) => { // Sử dụng oninput để phản hồi ngay lập tức
            if (gameState.isBoardLocked) return;

            let value = event.target.value;
            const currentInputIndex = index; // Lưu chỉ số của ô hiện tại

            // Xử lý trường hợp input rỗng (người dùng xóa số)
            if (value === '') {
                gameState.bingoBoard[currentInputIndex] = null;
                event.target.classList.remove('invalid');
                return; // Không cần kiểm tra thêm cho input rỗng
            }
            if (value.length > 2) {
                value = value.slice(0, 2);
                event.target.value = value;
            }
            const num = parseInt(value);

            let isCurrentInputValid = true;
            // 1. Kiểm tra dải số (1-25)
            if (isNaN(num) || num < MIN_NUMBER || num > MAX_NUMBER) {
                isCurrentInputValid = false;
            } else {
                // 2. Kiểm tra tính duy nhất (không trùng với các ô khác) bằng Set để đảm bảo so sánh nghiêm ngặt
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
                // Auto-focus next cell
                if (value.length === 2 || (value.length === 1 && num > 9)) { // If 2 digits or 1 digit > 9
                    const nextInput = inputs[currentInputIndex + 1];
                    if (nextInput) {
                        nextInput.focus();
                    }
                }
            } else {
                gameState.bingoBoard[currentInputIndex] = null;
                event.target.classList.add('invalid');
                // Stricter limit: if the input is invalid and not empty, clear it
                // This prevents numbers like "0" or "26" from staying in the input field
                if (value !== '') {
                    event.target.value = '';
                }
            }
        };

        // Cell click for selection (after board is locked)
        input.parentElement.onclick = () => {
            if (gameState.isBoardLocked && !gameState.isGameOver) {
                toggleCellSelection(index);
            }
        };
    });
}

// The event listeners below were calling `applyRippleEffect` redundantly.
// The generic listener at the end of this section is the single, correct place
// to handle the ripple effect for all buttons.

DOMElements.randomFillBtn.addEventListener('click', (event) => {
    fillBoardRandomly();
});

DOMElements.lockBoardBtn.addEventListener('click', (event) => {
    validateAndLockBoard();
});

DOMElements.callNumberBtn.addEventListener('click', (event) => {
    callNextNumber();
});

DOMElements.resetGameBtn.addEventListener('click', (event) => {
    initializeGame(true); // Pass true to force a reset
});

DOMElements.newGameBtn.addEventListener('click', (event) => {
    if (confirm('Bạn có chắc chắn muốn bắt đầu một trò chơi mới? Toàn bộ tiến trình hiện tại sẽ bị xóa.')) {
        initializeGame(true); // Pass true to force a reset and clear storage
    }
});

DOMElements.toggleSoundBtn.addEventListener('click', (event) => {
    gameState.isMuted = !gameState.isMuted;
    audioManager.setMute(gameState.isMuted);
    updateSoundButtonUI();
    saveState();
});

DOMElements.themeSelector.addEventListener('click', (event) => {
    const themeBtn = event.target.closest('.theme-btn');
    if (!themeBtn) return;

    const themeName = themeBtn.dataset.theme;
    if (themeName) {
        applyTheme(themeName);
        saveState();
    }
});

// Add ripple effect to all cyber buttons
document.querySelectorAll('.cyber-button').forEach(button => {
    button.addEventListener('click', applyRippleEffect);
});
// --- 8. Initial Setup ---

// This function attempts to resume the AudioContext, which is required by modern browsers
// to play any sound. It must be called as a result of a user gesture (e.g., a click).
function unlockAudio() {
    if (audioManager && audioManager.audioContext.state === 'suspended') {
        audioManager.audioContext.resume();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize game without forcing a reset, which will load saved state
    // including the theme.
    initializeGame(false);
    // Add a one-time event listener to unlock the AudioContext on the first user interaction.
    document.body.addEventListener('click', unlockAudio, { once: true });
});