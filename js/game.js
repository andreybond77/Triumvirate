// ============================================================
// БИТВА ПОЛКОВОДЦЕВ — ИГРОВАЯ ЛОГИКА
// ============================================================

// ===== ПРОВЕРКА КАНВАСА =====
const canvas = document.getElementById('boardCanvas');
if (!canvas) {
    console.error('❌ Canvas не найден!');
}

const ctx = canvas ? canvas.getContext('2d') : null;
if (!ctx) {
    console.error('❌ Не удалось получить 2D контекст');
}

// ============================================================
// КОНСТАНТЫ ЦВЕТОВ (ПЕРЕНЕСЕНЫ НАВЕРХ — ФИКС ОШИБКИ СТАРТА)
// ============================================================

const COLORS = ['alpha', 'omega', 'delta'];
const EMOJI = { alpha: 'α', omega: 'ω', delta: 'δ' };

// ===== ПРАВИЛЬНАЯ ЛОГИКА ХИЩНИК-ЖЕРТВА =====
const PREDATOR = {
    alpha: 'delta',
    omega: 'alpha',
    delta: 'omega'
};

const COLOR_MAP = {
    alpha: '#e53935',
    omega: '#1e88e5',
    delta: '#43a047'
};

const COLOR_TO_LETTER = {
    alpha: 'α',
    omega: 'ω',
    delta: 'δ',
    red: 'α',
    blue: 'ω',
    green: 'δ'
};

// ===== СОСТОЯНИЕ ИГРЫ =====
let board = [];
let currentPlayer = 0;
let playerScore = 0;
let computerScore = 0;
let selectedPiece = null;
let validMoves = [];
let gameActive = false;
let waitingForPlacement = false;
let placementRemaining = 0;
let currentPlacementColor = null;
let placementIndex = 0;
let placementColors = [];
let computerBoardBackup = null;
let isAnimating = false;
let isGameOver = false;
let gameplayStarted = false;
let isComputerTurn = false;

// ===== GAME READY ФЛАГИ =====
let gameFullyReady = false;

// ===== ЧИТАЕМ СЛОЖНОСТЬ =====
const savedDifficulty = localStorage.getItem('tripleColorDifficulty') || 'medium';
let difficulty = savedDifficulty;

const DIFFICULTY_LABELS = {
    easy: '🟢 Лёгкая',
    medium: '🟡 Средняя',
    hard: '🔴 Сложная'
};
const diffBadge = document.getElementById('difficultyBadge');
if (diffBadge) {
    diffBadge.textContent = DIFFICULTY_LABELS[savedDifficulty] || '🟡 Средняя';
}

// ============================================================
// UNDO (ОТМЕНА ХОДА) — МАКСИМУМ 3 ОТМЕНЫ
// ============================================================

const MAX_UNDO = 3;
let undoHistory = [];
let undoCount = 0;

function saveUndoState() {
    if (isGameOver || isComputerTurn || waitingForPlacement) return;

    if (undoHistory.length >= MAX_UNDO) {
        undoHistory.shift();
    }

    undoHistory.push({
        board: JSON.parse(JSON.stringify(board)),
        playerScore: playerScore,
        computerScore: computerScore,
        currentPlayer: currentPlayer,
        isGameOver: isGameOver,
        selectedPiece: selectedPiece ? { row: selectedPiece.row, col: selectedPiece.col } : null,
        validMoves: JSON.parse(JSON.stringify(validMoves))
    });

    undoCount = undoHistory.length;
    updateUndoUI();
}

function undoLastMove() {
    if (undoHistory.length === 0) {
        showMessage('⚠️ Нет ходов для отмены!', '#ff9800');
        return false;
    }

    if (isGameOver) {
        showMessage('⚠️ Игра окончена! Нельзя отменить ход.', '#ff9800');
        return false;
    }

    if (isComputerTurn) {
        showMessage('⏳ Сейчас ход компьютера!', '#ff9800');
        return false;
    }

    if (waitingForPlacement) {
        showMessage('⚠️ Нельзя отменить во время расстановки!', '#ff9800');
        return false;
    }

    const state = undoHistory.pop();

    board = state.board;
    playerScore = state.playerScore;
    computerScore = state.computerScore;
    currentPlayer = state.currentPlayer;
    isGameOver = state.isGameOver;
    selectedPiece = state.selectedPiece;
    validMoves = state.validMoves || [];

    undoCount = undoHistory.length;
    updateUndoUI();

    updateUI();
    draw();
    showMessage(`↩️ Ход отменён! Осталось ${undoCount} отмен`, '#4CAF50');

    return true;
}

function countPieces(player) {
    let count = 0;
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const p = board[i] && board[i][j] ? board[i][j] : null;
            if (p && p.player === player) count++;
        }
    }
    return count;
}

function updateUndoUI() {
    const undoBtn = document.getElementById('undoBtn');
    if (!undoBtn) return;

    const hasUndo = undoHistory.length > 0;
    const isDisabled = isGameOver || isComputerTurn || waitingForPlacement || !hasUndo;

    undoBtn.disabled = isDisabled;
    undoBtn.style.opacity = hasUndo && !isDisabled ? 1 : 0.4;
}

// ============================================================
// ТАЙМЕР ХОДА (10 СЕКУНД НА СЛОЖНОМ РЕЖИМЕ)
// ============================================================

let timerInterval = null;
let timerSeconds = 0;
const TIMER_MAX = 10;
let timerEnabled = false;

function startTimer() {
    const diff = getDifficulty();
    timerEnabled = (diff.id === 'hard');

    if (!timerEnabled || isGameOver || isComputerTurn || waitingForPlacement) {
        hideTimer();
        return;
    }

    timerSeconds = TIMER_MAX;
    updateTimerDisplay();

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();

        if (timerSeconds <= 3 && timerSeconds > 0) {
            playTickSound();
        }

        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            showMessage('⏰ Время вышло! Ход пропущен.', '#f44336');

            if (!isGameOver && !isComputerTurn && !waitingForPlacement) {
                setTimeout(() => {
                    currentPlayer = 1;
                    isComputerTurn = true;
                    updateUI();
                    computerMove();
                }, 500);
            }
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerSeconds = 0;
    hideTimer();
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timerDisplay');
    if (!timerDisplay) return;

    if (timerEnabled && timerSeconds > 0 && !isGameOver && !isComputerTurn && !waitingForPlacement) {
        timerDisplay.textContent = `⏱️ ${timerSeconds}s`;
        timerDisplay.style.color = timerSeconds <= 3 ? '#f44336' : '#FFD700';
        timerDisplay.style.display = 'block';
    } else {
        timerDisplay.style.display = 'none';
    }
}

function hideTimer() {
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) {
        timerDisplay.style.display = 'none';
    }
}

// ============================================================
// ГЕТТЕР СЛОЖНОСТИ
// ============================================================

function getDifficulty() {
    const diff = localStorage.getItem('tripleColorDifficulty') || 'medium';
    return {
        id: diff,
        name: DIFFICULTY_LABELS[diff] || 'Средняя'
    };
}

// ============================================================
// РАЗМЕР КАНВАСА — АДАПТИВНЫЙ
// ============================================================

function resizeCanvas() {
    const canvasEl = document.getElementById('boardCanvas');
    if (!canvasEl) return;

    const container = canvasEl.parentElement;
    if (!container) return;

    const gameCenter = document.querySelector('.game-center');
    const topSection = document.querySelector('.top-section');
    const bottomSection = document.querySelector('.bottom-section');

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isSmall = screenWidth < 420 || screenHeight < 600;

    const gameEl = document.querySelector('.game');
    const gameRect = gameEl ? gameEl.getBoundingClientRect() : { width: screenWidth };
    const availableWidth = Math.min(gameRect.width - 4, 600);

    const topHeight = topSection ? topSection.offsetHeight : 0;
    const bottomHeight = bottomSection ? bottomSection.offsetHeight : 0;

    const availableHeight = screenHeight - topHeight - bottomHeight - 10;

    let size;
    if (isSmall) {
        size = Math.min(availableWidth, availableHeight);
        size = Math.min(size, screenWidth - 4);
    } else {
        size = Math.min(availableWidth, availableHeight, 500);
    }

    if (size > 0 && size > 50) {
        canvasEl.width = size;
        canvasEl.height = size;
        canvasEl.style.width = size + 'px';
        canvasEl.style.height = size + 'px';

        if (container) {
            container.style.width = size + 'px';
            container.style.height = size + 'px';
        }
        if (gameCenter) {
            gameCenter.style.width = size + 'px';
        }
        if (topSection) {
            topSection.style.width = size + 'px';
        }
        if (bottomSection) {
            bottomSection.style.width = size + 'px';
        }

        window._cellSize = size / 8;

        setTimeout(() => {
            if (board && board.length > 0) {
                draw();
                updateAllSizes();
            }
        }, 10);
    }
}

// ============================================================
// ОБНОВЛЕНИЕ РАЗМЕРОВ ВСЕХ ЭЛЕМЕНТОВ
// ============================================================
function updateAllSizes() {
    const cellSize = window._cellSize || 50;
    const boardSize = cellSize * 8;
    const hintSize = Math.max(cellSize, 28);
    const fontSize = Math.max(hintSize * 0.45, 12);
    const iconSize = Math.min(hintSize * 1.1, 56);
    const smallFont = Math.max(fontSize * 0.7, 9);

    const timerEl = document.getElementById('timerDisplay');
    const header = document.querySelector('.header');

    const boardWrap = document.querySelector('.board-wrap');
    const topSection = document.querySelector('.top-section');
    const bottomSection = document.querySelector('.bottom-section');
    const gameCenter = document.querySelector('.game-center');

    if (boardWrap) {
        boardWrap.style.width = boardSize + 'px';
        boardWrap.style.height = boardSize + 'px';
    }
    if (topSection) topSection.style.width = boardSize + 'px';
    if (bottomSection) bottomSection.style.width = boardSize + 'px';
    if (gameCenter) gameCenter.style.width = boardSize + 'px';

    // 1. КНОПКИ ХЕДЕРА
    document.querySelectorAll('.icon-btn, .exit-btn').forEach(btn => {
        btn.style.width = iconSize + 'px';
        btn.style.height = iconSize + 'px';
        btn.style.minWidth = iconSize + 'px';
        btn.style.minHeight = iconSize + 'px';
        const fSize = Math.max(iconSize * 0.45, 10);
        btn.style.fontSize = fSize + 'px';
        btn.style.borderWidth = Math.max(1, iconSize * 0.04) + 'px';
    });

    // 2. Таймер
    if (timerEl) {
        const height = Math.max(iconSize * 0.7, 20);
        timerEl.style.height = height + 'px';
        timerEl.style.lineHeight = height + 'px';
        timerEl.style.fontSize = Math.max(height * 0.5, 11) + 'px';
        timerEl.style.minWidth = Math.max(iconSize * 0.7, 28) + 'px';
        timerEl.style.padding = '0 ' + Math.max(4, iconSize * 0.12) + 'px';
    }

    // 3. Header
    if (header) {
        const headerHeight = Math.max(iconSize * 1.2, 30);
        header.style.minHeight = headerHeight + 'px';
        header.style.maxHeight = (headerHeight + 6) + 'px';
        header.style.padding = Math.max(1, iconSize * 0.05) + 'px ' + Math.max(2, iconSize * 0.12) + 'px';
        header.style.gap = Math.max(2, iconSize * 0.08) + 'px';
    }

    // 4. Info bar
    const infoBar = document.querySelector('.info-bar');
    if (infoBar) {
        const barHeight = Math.max(iconSize * 0.7, 22);
        infoBar.style.minHeight = barHeight + 'px';
        infoBar.style.padding = Math.max(1, iconSize * 0.04) + 'px ' + Math.max(3, iconSize * 0.12) + 'px';
        infoBar.style.gap = Math.max(2, iconSize * 0.08) + 'px';
        infoBar.style.margin = '0 0 ' + Math.max(1, iconSize * 0.04) + 'px 0';
    }

    // 5. Info computer/player
    document.querySelectorAll('.info-computer, .info-player').forEach(el => {
        const fSize = Math.max(smallFont, 9);
        el.style.fontSize = fSize + 'px';
        el.style.gap = Math.max(1, fSize * 0.2) + 'px';
    });

    // 6. Info difficulty
    const difficultyBadgeEl = document.getElementById('difficultyBadge');
    if (difficultyBadgeEl) {
        const fSize = Math.max(smallFont, 9);
        difficultyBadgeEl.style.fontSize = fSize + 'px';
        const padding = Math.max(2, fSize * 0.4);
        difficultyBadgeEl.style.padding = '0 ' + padding + 'px';
        const height = Math.max(iconSize * 0.55, 18);
        difficultyBadgeEl.style.lineHeight = height + 'px';
        difficultyBadgeEl.style.height = height + 'px';
    }

    // 7. Game info
    const gameInfo = document.querySelector('.game-info');
    if (gameInfo) {
        const infoHeight = Math.max(iconSize * 0.7, 24);
        gameInfo.style.minHeight = infoHeight + 'px';
        gameInfo.style.padding = Math.max(1, iconSize * 0.04) + 'px ' + Math.max(3, iconSize * 0.12) + 'px';
        gameInfo.style.gap = Math.max(1, iconSize * 0.04) + 'px';
        gameInfo.style.margin = Math.max(1, iconSize * 0.04) + 'px 0 0 0';
    }

    // 8. Game info message
    const gameMsg = document.getElementById('gameMessage');
    if (gameMsg) {
        const fSize = Math.max(smallFont, 9);
        gameMsg.style.fontSize = fSize + 'px';
        gameMsg.style.minHeight = Math.max(fSize * 1.2, 14) + 'px';
        gameMsg.style.padding = '0 ' + Math.max(2, fSize * 0.3) + 'px';
    }

    // 9. Шашки-подсказки
    document.querySelectorAll('.color-btn, .medium-piece').forEach(btn => {
        const canvasEl = btn.querySelector('canvas');
        if (canvasEl) {
            const size = Math.min(hintSize, 64);
            canvasEl.width = size;
            canvasEl.height = size;
            canvasEl.style.width = size + 'px';
            canvasEl.style.height = size + 'px';
            canvasEl.style.borderWidth = Math.max(1, size * 0.04) + 'px';

            const color = btn.dataset.color;
            if (color) {
                redrawHintPiece(canvasEl, color, size, fontSize);
            }
        }
        btn.style.width = hintSize + 'px';
        btn.style.height = hintSize + 'px';
        btn.style.fontSize = fontSize + 'px';
        btn.style.borderWidth = Math.max(1, hintSize * 0.04) + 'px';
    });

    // 10. Placement panel
    const placementPanel = document.getElementById('placementPanel');
    if (placementPanel) {
        placementPanel.style.marginTop = Math.max(1, hintSize * 0.04) + 'px';
    }

    // 11. Color selector
    const colorSelector = document.getElementById('colorSelector');
    if (colorSelector) {
        colorSelector.style.gap = Math.max(2, hintSize * 0.08) + 'px';
        colorSelector.style.margin = Math.max(1, hintSize * 0.04) + 'px 0';
    }

    // 12. Medium place
    const mediumPlace = document.getElementById('mediumPlace');
    if (mediumPlace) {
        mediumPlace.style.margin = Math.max(1, hintSize * 0.04) + 'px 0';
    }

    // 13. Medium piece
    const mediumPiece = document.getElementById('mediumPiece');
    if (mediumPiece) {
        const canvasEl = mediumPiece.querySelector('canvas');
        if (canvasEl) {
            const size = Math.min(hintSize, 64);
            canvasEl.width = size;
            canvasEl.height = size;
            canvasEl.style.width = size + 'px';
            canvasEl.style.height = size + 'px';
            canvasEl.style.borderWidth = Math.max(1, size * 0.04) + 'px';
        }
        mediumPiece.style.width = hintSize + 'px';
        mediumPiece.style.height = hintSize + 'px';
        mediumPiece.style.fontSize = fontSize + 'px';
        mediumPiece.style.borderWidth = Math.max(1, hintSize * 0.04) + 'px';
    }
}

// ============================================================
// ПЕРЕРИСОВКА ШАШКИ-ПОДСКАЗКИ НА МИНИ-КАНВАСЕ
// ============================================================
function redrawHintPiece(miniCanvas, color, size, fontSize) {
    const miniCtx = miniCanvas.getContext('2d');
    const colorHex = COLOR_MAP[color] || '#888';
    const letter = COLOR_TO_LETTER[color] || '?';
    const cell = size;
    const radius = cell / 2 - Math.max(2, cell / 25);
    const innerRadius = radius * 0.72;

    miniCtx.clearRect(0, 0, cell, cell);

    const rimGradient = miniCtx.createRadialGradient(
        cell/2 - radius * 0.3, cell/2 - radius * 0.3, radius * 0.1,
        cell/2, cell/2, radius
    );
    rimGradient.addColorStop(0, '#ffffff');
    rimGradient.addColorStop(0.7, '#f0f0f0');
    rimGradient.addColorStop(1, '#d0d0d0');
    miniCtx.beginPath();
    miniCtx.arc(cell/2, cell/2, radius, 0, Math.PI * 2);
    miniCtx.fillStyle = rimGradient;
    miniCtx.fill();
    miniCtx.strokeStyle = '#c0c0c0';
    miniCtx.lineWidth = Math.max(1, cell / 40);
    miniCtx.stroke();

    const colorGradient = miniCtx.createRadialGradient(
        cell/2 - innerRadius * 0.3, cell/2 - innerRadius * 0.3, innerRadius * 0.1,
        cell/2, cell/2, innerRadius
    );
    colorGradient.addColorStop(0, lightenColor(colorHex, 50));
    colorGradient.addColorStop(0.5, lightenColor(colorHex, 25));
    colorGradient.addColorStop(1, colorHex);
    miniCtx.beginPath();
    miniCtx.arc(cell/2, cell/2, innerRadius, 0, Math.PI * 2);
    miniCtx.fillStyle = colorGradient;
    miniCtx.fill();
    miniCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    miniCtx.lineWidth = Math.max(0.5, cell / 80);
    miniCtx.stroke();

    const letterColor = darkenColor(colorHex, 50);
    const fSize = Math.max(fontSize, 12);
    miniCtx.font = `bold ${fSize}px "Georgia", "Times New Roman", serif`;
    miniCtx.textAlign = 'center';
    miniCtx.textBaseline = 'middle';
    miniCtx.shadowBlur = Math.max(4, cell / 12);
    miniCtx.shadowColor = 'rgba(255,255,255,0.15)';
    miniCtx.fillStyle = letterColor;
    miniCtx.fillText(letter, cell/2, cell/2);
    miniCtx.shadowBlur = 0;
    miniCtx.fillStyle = 'rgba(0,0,0,0.08)';
    miniCtx.fillText(letter, cell/2 + 1, cell/2 + 1);
    miniCtx.fillStyle = 'rgba(255,255,255,0.3)';
    miniCtx.fillText(letter, cell/2 - 0.5, cell/2 - 0.5);
    miniCtx.shadowBlur = 0;
    miniCtx.fillStyle = letterColor;
    miniCtx.fillText(letter, cell/2, cell/2);

    const highlightGradient = miniCtx.createRadialGradient(
        cell/2 - innerRadius * 0.35, cell/2 - innerRadius * 0.35, innerRadius * 0.05,
        cell/2 - innerRadius * 0.35, cell/2 - innerRadius * 0.35, innerRadius * 0.4
    );
    highlightGradient.addColorStop(0, 'rgba(255,255,255,0.35)');
    highlightGradient.addColorStop(1, 'rgba(255,255,255,0)');
    miniCtx.beginPath();
    miniCtx.arc(cell/2, cell/2, innerRadius, 0, Math.PI * 2);
    miniCtx.fillStyle = highlightGradient;
    miniCtx.fill();
}

// ============================================================
// АДАПТИВНОЕ МАСШТАБИРОВАНИЕ
// ============================================================

function applyAdaptiveScaling() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    let scale = 1;
    if (screenWidth < 320) {
        scale = 0.65;
    } else if (screenWidth < 380) {
        scale = 0.75;
    } else if (screenWidth < 420) {
        scale = 0.85;
    } else if (screenWidth < 480) {
        scale = 0.92;
    } else if (screenWidth < 600) {
        scale = 0.98;
    } else if (screenWidth < 768) {
        scale = 1.0;
    } else {
        scale = Math.min(1.1, screenWidth / 768);
    }

    if (screenHeight < 500 && screenWidth > screenHeight) {
        scale = Math.min(scale, 0.75);
    }

    document.documentElement.style.setProperty('--ui-scale', scale);
    document.documentElement.style.setProperty('--font-scale', Math.max(0.6, scale));

    updateAllSizes();
}

// ============================================================
// GAME READY API — ОТПРАВЛЯЕТСЯ ЗДЕСЬ (п. 1.19)
// ============================================================

function onGameFullyReady() {
    if (gameFullyReady) return;
    gameFullyReady = true;
    console.log('✅ Игра полностью готова к взаимодействию!');

    // Отправляем Game Ready именно здесь — когда игрок уже может играть
    if (typeof window.sendGameReadyImmediate === 'function') {
        window.sendGameReadyImmediate();
    } else {
        console.warn('⚠️ sendGameReadyImmediate недоступен');
    }
}

function notifyGameplayStart() {
    if (gameplayStarted) return;
    gameplayStarted = true;
    try {
        if (typeof window.ysdk !== 'undefined' && window.ysdk && window.ysdk.features && window.ysdk.features.GameplayAPI) {
            window.ysdk.features.GameplayAPI.start();
            console.log('✅ Gameplay Start');
        }
    } catch (e) {
        console.warn('⚠️ Gameplay Start ошибка:', e);
    }
}

function notifyGameplayStop() {
    if (!gameplayStarted) return;
    gameplayStarted = false;
    try {
        if (typeof window.ysdk !== 'undefined' && window.ysdk && window.ysdk.features && window.ysdk.features.GameplayAPI) {
            window.ysdk.features.GameplayAPI.stop();
            console.log('✅ Gameplay Stop');
        }
    } catch (e) {
        console.warn('⚠️ Gameplay Stop ошибка:', e);
    }
}

window.notifyGameplayStart = notifyGameplayStart;
window.notifyGameplayStop = notifyGameplayStop;

document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        notifyGameplayStop();
        stopTimer();
        if (window._audioCtx && window._audioCtx.state === 'running') {
            window._audioCtx.suspend();
        }
    } else {
        notifyGameplayStart();
        if (window._audioCtx && window._audioCtx.state === 'suspended') {
            window._audioCtx.resume();
        }
        if (!isGameOver && !isComputerTurn && !waitingForPlacement) {
            startTimer();
        }
    }
});

// ============================================================
// ЗВУКИ
// ============================================================
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            window._audioCtx = audioCtx;
        } catch (e) {
            console.warn('Web Audio API не поддерживается');
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!soundEnabled || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        gain.gain.value = volume;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

const sounds = {
    move: () => playTone(440, 0.1, 'sine', 0.2),
    capture: () => {
        playTone(220, 0.12, 'sawtooth', 0.25);
        setTimeout(() => playTone(165, 0.15, 'sawtooth', 0.2), 60);
    },
    swap: () => {
        playTone(330, 0.1, 'triangle', 0.2);
        setTimeout(() => playTone(440, 0.1, 'triangle', 0.2), 80);
    },
    preyEaten: () => {
        playTone(600, 0.08, 'sine', 0.3);
        setTimeout(() => playTone(300, 0.15, 'sawtooth', 0.25), 50);
        setTimeout(() => playTone(150, 0.2, 'square', 0.2), 100);
    },
    win: () => {
        [523, 659, 784, 1047].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 0.25, 'sine', 0.3), i * 120);
        });
    },
    lose: () => {
        [400, 300, 200].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 0.3, 'sawtooth', 0.2), i * 150);
        });
    },
    draw: () => {
        [440, 550, 440].forEach((freq, i) => {
            setTimeout(() => playTone(freq, 0.15, 'sine', 0.25), i * 150);
        });
    },
    click: () => playTone(800, 0.05, 'sine', 0.15),
    select: () => playTone(660, 0.08, 'sine', 0.2),
    error: () => playTone(150, 0.15, 'square', 0.15),
    tick: () => playTone(1000, 0.05, 'sine', 0.1)
};

function playTickSound() {
    if (soundEnabled && audioCtx) {
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 1000 + (timerSeconds % 2 === 0 ? 0 : 200);
            gain.gain.value = 0.08;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
            osc.stop(audioCtx.currentTime + 0.04);
        } catch (e) {}
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('tripleColorSound', soundEnabled ? '1' : '0');
    const btn = document.getElementById('soundBtn');
    if (btn) {
        btn.textContent = soundEnabled ? '🔊' : '🔇';
        btn.classList.toggle('muted', !soundEnabled);
    }
    if (soundEnabled) {
        initAudio();
        sounds.click();
    }
}

(function loadSoundState() {
    const saved = localStorage.getItem('tripleColorSound');
    if (saved === '0') {
        soundEnabled = false;
        const btn = document.getElementById('soundBtn');
        if (btn) {
            btn.textContent = '🔇';
            btn.classList.add('muted');
        }
    }
})();

// ============================================================
// HAPTIC FEEDBACK
// ============================================================
async function hapticFeedback(type = 'light') {
    try {
        if (navigator.onLine && typeof window.ysdk !== 'undefined' && window.ysdk && window.ysdk.hapticFeedback) {
            const impactTypes = {
                'light': 'light',
                'medium': 'medium',
                'heavy': 'heavy',
                'success': 'success',
                'error': 'error',
                'warning': 'warning'
            };
            await window.ysdk.hapticFeedback.impactOccurred(impactTypes[type] || 'light');
            return;
        }
    } catch (e) {}

    if ('vibrate' in navigator) {
        const patterns = {
            'light': [10],
            'medium': [20],
            'heavy': [40],
            'success': [50, 30, 50],
            'error': [100, 50, 100],
            'warning': [30, 20, 30]
        };
        try {
            navigator.vibrate(patterns[type] || [10]);
        } catch (e) {}
    }
}

// ============================================================
// ДОСКА
// ============================================================
function initBoard() {
    board = [];
    for (let i = 0; i < 8; i++) {
        board[i] = [];
        for (let j = 0; j < 8; j++) {
            board[i][j] = null;
        }
    }
    console.log('✅ Доска инициализирована');
}

function getComputerPositions() {
    const positions = [];
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) positions.push({ row, col });
        }
    }
    return positions;
}

function getPlayerPositions() {
    const positions = [];
    for (let row = 5; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) positions.push({ row, col });
        }
    }
    return positions;
}

function getColorName(color) {
    if (!color || typeof color !== 'string') return '❓ Неизвестный';
    if (color === 'alpha' || color === 'red') return 'α Альфа';
    if (color === 'omega' || color === 'blue') return 'ω Омега';
    if (color === 'delta' || color === 'green') return 'δ Дельта';
    return '❓ Неизвестный';
}

function lightenColor(color, percent) {
    if (!color) return '#888';
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `rgb(${R}, ${G}, ${B})`;
}

function darkenColor(color, percent) {
    if (!color) return '#444';
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `rgb(${R}, ${G}, ${B})`;
}

// ============================================================
// UI
// ============================================================
function showMessage(msg, color) {
    const el = document.getElementById('gameMessage');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('success', 'error', 'info', 'warning');
    if (color === '#4CAF50') el.classList.add('success');
    else if (color === '#f44336') el.classList.add('error');
    else if (color === '#2196F3') el.classList.add('info');
    else if (color === '#ff9800') el.classList.add('warning');
    el.style.color = color || '#ff9800';
}

function updateUI() {
    const playerScoreDisplay = document.getElementById('playerScoreDisplay');
    const computerScoreDisplay = document.getElementById('computerScoreDisplay');
    if (playerScoreDisplay) playerScoreDisplay.textContent = playerScore;
    if (computerScoreDisplay) computerScoreDisplay.textContent = computerScore;

    const badges = { easy: '🟢 Лёгкая', medium: '🟡 Средняя', hard: '🔴 Сложная' };
    const badge = document.getElementById('difficultyBadge');
    if (badge) {
        badge.textContent = badges[difficulty] || '🟡 Средняя';
    }

    updateUndoUI();
    updateTimerDisplay();
}

// ============================================================
// ОТРИСОВКА ШАШЕК
// ============================================================
function drawPieceAt(x, y, piece, cell, highlightColor = null) {
    if (!piece || !piece.color) return;
    if (!cell || cell <= 0) return;

    const radius = cell / 2 - Math.max(2, cell / 25);
    if (radius <= 0) return;

    const color = COLOR_MAP[piece.color] || '#888';
    const isPlayer = piece.player === 0;
    const letter = COLOR_TO_LETTER[piece.color] || '?';

    const innerRadius = radius * 0.72;
    const letterRadius = radius * 0.52;

    let fontSize;
    if (cell < 30) {
        fontSize = letterRadius * 2.4;
    } else if (cell < 40) {
        fontSize = letterRadius * 2.2;
    } else if (cell < 50) {
        fontSize = letterRadius * 2.0;
    } else {
        fontSize = letterRadius * 1.8;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    const rimGradient = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, radius * 0.1,
        x, y, radius
    );
    if (isPlayer) {
        rimGradient.addColorStop(0, '#ffffff');
        rimGradient.addColorStop(0.7, '#f0f0f0');
        rimGradient.addColorStop(1, '#d0d0d0');
    } else {
        rimGradient.addColorStop(0, '#666666');
        rimGradient.addColorStop(0.7, '#444444');
        rimGradient.addColorStop(1, '#222222');
    }
    ctx.fillStyle = rimGradient;
    ctx.fill();

    ctx.strokeStyle = isPlayer ? '#c0c0c0' : '#555555';
    ctx.lineWidth = Math.max(1.5, cell / 40);
    ctx.stroke();

    const colorGradient = ctx.createRadialGradient(
        x - innerRadius * 0.3, y - innerRadius * 0.3, innerRadius * 0.1,
        x, y, innerRadius
    );

    if (isPlayer) {
        colorGradient.addColorStop(0, lightenColor(color, 50));
        colorGradient.addColorStop(0.5, lightenColor(color, 25));
        colorGradient.addColorStop(1, color);
    } else {
        colorGradient.addColorStop(0, lightenColor(color, 15));
        colorGradient.addColorStop(0.5, color);
        colorGradient.addColorStop(1, darkenColor(color, 30));
    }

    ctx.beginPath();
    ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = colorGradient;
    ctx.fill();

    ctx.strokeStyle = isPlayer ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = Math.max(0.5, cell / 80);
    ctx.stroke();

    let letterColor;
    if (isPlayer) {
        letterColor = darkenColor(color, 50);
    } else {
        letterColor = lightenColor(color, 55);
    }

    if (highlightColor) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = highlightColor;
    } else {
        ctx.shadowBlur = isPlayer ? 6 : 8;
        ctx.shadowColor = isPlayer ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)';
    }

    ctx.font = `bold ${fontSize}px "Georgia", "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = letterColor;
    ctx.fillText(letter, x, y);

    ctx.shadowBlur = 0;
    if (isPlayer) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillText(letter, x + 1, y + 1);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(letter, x - 0.5, y - 0.5);
    } else {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillText(letter, x - 0.5, y - 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillText(letter, x + 0.5, y + 0.5);
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = letterColor;
    ctx.fillText(letter, x, y);

    if (!highlightColor) {
        const highlightGradient = ctx.createRadialGradient(
            x - innerRadius * 0.35, y - innerRadius * 0.35, innerRadius * 0.05,
            x - innerRadius * 0.35, y - innerRadius * 0.35, innerRadius * 0.4
        );
        highlightGradient.addColorStop(0, isPlayer ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)');
        highlightGradient.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.beginPath();
        ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = highlightGradient;
        ctx.fill();
    }

    if (highlightColor) {
        ctx.beginPath();
        ctx.arc(x, y, innerRadius * 0.9, 0, Math.PI * 2);
        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = Math.max(3, cell / 20);
        ctx.shadowBlur = 20;
        ctx.shadowColor = highlightColor;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

// ============================================================
// ОТРИСОВКА ДОСКИ
// ============================================================
function draw() {
    try {
        const canvasEl = document.getElementById('boardCanvas');
        if (!canvasEl || !ctx) return;
        if (canvasEl.width === 0 || canvasEl.height === 0) return;
        if (!board || board.length === 0) return;

        const cell = canvasEl.width / 8;
        if (cell <= 0) return;

        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const isDark = (row + col) % 2 === 1;
                ctx.fillStyle = isDark ? '#8B4513' : '#F0D9B5';
                ctx.fillRect(col * cell, row * cell, cell, cell);
            }
        }

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row] && board[row][col] ? board[row][col] : null;
                if (piece && piece.color) {
                    const x = col * cell + cell / 2;
                    const y = row * cell + cell / 2;
                    drawPieceAt(x, y, piece, cell);
                }
            }
        }

        if (selectedPiece) {
            const x = selectedPiece.col * cell;
            const y = selectedPiece.row * cell;

            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = Math.max(3, cell / 20);
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#FFD700';
            ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
            ctx.shadowBlur = 0;

            for (const move of validMoves) {
                const targetPiece = board[move.row] && board[move.row][move.col] ? board[move.row][move.col] : null;
                if (!targetPiece || targetPiece.player === 0) continue;

                const tx = move.col * cell + cell / 2;
                const ty = move.row * cell + cell / 2;

                let highlightColor = null;
                if (move.type === 'prey') {
                    highlightColor = '#7FFF00';
                } else if (move.type === 'capture') {
                    highlightColor = '#FF1493';
                } else if (move.type === 'swap') {
                    highlightColor = '#FFD700';
                }

                if (highlightColor) {
                    drawPieceAt(tx, ty, targetPiece, cell, highlightColor);
                }
            }

            for (const move of validMoves) {
                if (move.type === 'move') {
                    const mx = move.col * cell + cell / 2;
                    const my = move.row * cell + cell / 2;
                    const radius = cell / 6;
                    ctx.beginPath();
                    ctx.arc(mx, my, radius, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(76, 175, 80, 0.5)';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(76, 175, 80, 0.8)';
                    ctx.lineWidth = Math.max(1, cell / 40);
                    ctx.stroke();
                }
            }
        }

        if (waitingForPlacement && difficulty !== 'medium') {
            for (let row = 5; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    if ((row + col) % 2 === 1 && board[row] && board[row][col] === null) {
                        ctx.fillStyle = 'rgba(76, 175, 80, 0.25)';
                        ctx.fillRect(col * cell, row * cell, cell, cell);
                    }
                }
            }
        }
    } catch (e) {
        console.warn('⚠️ Ошибка отрисовки:', e);
    }
}

// ============================================================
// ПРАВИЛА ХОДОВ
// ============================================================
function isValidMove(piece, fromRow, fromCol, toRow, toCol) {
    const target = board[toRow] && board[toRow][toCol] ? board[toRow][toCol] : null;
    const dx = toCol - fromCol;
    const dy = toRow - fromRow;
    const isMove = (Math.abs(dx) + Math.abs(dy) === 1) && (dx === 0 || dy === 0);
    const isDiag = (Math.abs(dx) === 1 && Math.abs(dy) === 1);

    if (isMove && target === null) return { valid: true, type: 'move' };

    if (isDiag && target && target.player !== piece.player) {
        if (PREDATOR[piece.color] === target.color) {
            return { valid: true, type: 'prey', target };
        }
        if (PREDATOR[target.color] === piece.color) {
            return { valid: true, type: 'capture', target };
        }
        if (piece.color === target.color) {
            return { valid: true, type: 'swap', target };
        }
    }

    return { valid: false };
}

function calculateValidMoves(row, col) {
    const piece = board[row] && board[row][col] ? board[row][col] : null;
    if (!piece || piece.player !== 0) return [];
    const moves = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const result = isValidMove(piece, row, col, nr, nc);
                if (result.valid) {
                    moves.push({
                        row: nr,
                        col: nc,
                        type: result.type,
                        target: result.target
                    });
                }
            }
        }
    }
    return moves;
}

// ============================================================
// АНИМАЦИЯ ХОДА
// ============================================================
function animateMove(fromRow, fromCol, toRow, toCol, piece, callback) {
    isAnimating = true;
    const canvasEl = document.getElementById('boardCanvas');
    if (!canvasEl) { isAnimating = false; callback(); return; }
    const cell = canvasEl.width / 8;
    const startX = fromCol * cell + cell / 2;
    const startY = fromRow * cell + cell / 2;
    const endX = toCol * cell + cell / 2;
    const endY = toRow * cell + cell / 2;
    const duration = 220;
    const startTime = performance.now();

    function frame(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentX = startX + (endX - startX) * easeProgress;
        const currentY = startY + (endY - startY) * easeProgress;

        draw();
        drawPieceAt(currentX, currentY, piece, cell);

        if (progress < 1) {
            requestAnimationFrame(frame);
        } else {
            isAnimating = false;
            callback();
        }
    }
    requestAnimationFrame(frame);
}

// ============================================================
// ВЫПОЛНЕНИЕ ХОДА
// ============================================================
function makeMoveAnimated(fromRow, fromCol, toRow, toCol, moveInfo) {
    const piece = board[fromRow] && board[fromRow][fromCol] ? board[fromRow][fromCol] : null;
    if (!piece) return;

    saveUndoState();

    selectedPiece = null;
    validMoves = [];

    board[fromRow][fromCol] = null;

    animateMove(fromRow, fromCol, toRow, toCol, piece, () => {
        if (moveInfo.type === 'prey') {
            board[toRow][toCol] = piece;
            playerScore++;
            if (sounds.capture) sounds.capture();
            if (typeof hapticFeedback === 'function') {
                hapticFeedback('heavy');
            }
            updateUI();
            let targetColor = 'неизвестную';
            if (moveInfo.target && typeof moveInfo.target === 'object' && moveInfo.target.color) {
                targetColor = getColorName(moveInfo.target.color);
            }
            showMessage(`💚 +1 очко! Съедена ${targetColor} шашка`, '#4CAF50');

        } else if (moveInfo.type === 'capture') {
            const predator = board[toRow] && board[toRow][toCol] ? board[toRow][toCol] : null;
            board[fromRow][fromCol] = null;
            board[toRow][toCol] = predator;
            computerScore++;
            if (sounds.preyEaten) sounds.preyEaten();
            if (typeof hapticFeedback === 'function') {
                hapticFeedback('error');
            }
            updateUI();
            let pieceColor = 'неизвестную';
            if (piece && typeof piece === 'object' && piece.color) {
                pieceColor = getColorName(piece.color);
            }
            showMessage(`🌸 Ваша ${pieceColor} шашка уничтожена! Компьютер +1 очко`, '#f44336');

        } else if (moveInfo.type === 'swap') {
            const targetPiece = board[toRow] && board[toRow][toCol] ? board[toRow][toCol] : null;
            board[toRow][toCol] = piece;
            board[fromRow][fromCol] = targetPiece;
            if (sounds.swap) sounds.swap();
            if (typeof hapticFeedback === 'function') {
                hapticFeedback('medium');
            }
            showMessage(`🔄 Шашки поменялись местами`, '#ff9800');

        } else {
            board[toRow][toCol] = piece;
            if (sounds.move) sounds.move();
            if (typeof hapticFeedback === 'function') {
                hapticFeedback('light');
            }
            showMessage(`⬜ Ход сделан`, '#2196F3');
        }

        draw();
        checkGameOver();

        if (gameActive && !isGameOver) {
            currentPlayer = 1;
            isComputerTurn = true;
            updateUI();
            showMessage('🤖 Ход компьютера...', '#ff9800');
            stopTimer();
            setTimeout(() => computerMove(), 400);
        } else if (!isGameOver) {
            startTimer();
        }
    });
}

// ============================================================
// ПРОВЕРКА КОНЦА ИГРЫ
// ============================================================
function checkGameOver() {
    const colorsOnBoard = new Set();
    let playerPieces = 0;
    let computerPieces = 0;

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const p = board[i] && board[i][j] ? board[i][j] : null;
            if (p) {
                colorsOnBoard.add(p.color);
                if (p.player === 0) playerPieces++;
                else computerPieces++;
            }
        }
    }

    if (colorsOnBoard.size <= 1) {
        let winner = null;
        let diff = 0;

        if (playerPieces === 0 && computerPieces === 0) {
            winner = 'draw';
            diff = 0;
        } else if (playerPieces > computerPieces) {
            winner = 'player';
            diff = playerPieces - computerPieces;
        } else if (computerPieces > playerPieces) {
            winner = 'computer';
            diff = computerPieces - playerPieces;
        } else {
            winner = 'draw';
            diff = 0;
        }

        endGame(winner, diff);
        return true;
    }

    if (playerPieces === 0) {
        endGame('computer', computerPieces);
        return true;
    }

    if (computerPieces === 0) {
        endGame('player', playerPieces);
        return true;
    }

    if (!hasPlayerMoves() && currentPlayer === 0) {
        if (hasComputerMoves()) {
            currentPlayer = 1;
            isComputerTurn = true;
            updateUI();
            showMessage('🤖 Ход компьютера...', '#ff9800');
            stopTimer();
            setTimeout(() => computerMove(), 400);
            return false;
        } else {
            if (playerPieces > computerPieces) {
                endGame('player', playerPieces - computerPieces);
            } else if (computerPieces > playerPieces) {
                endGame('computer', computerPieces - playerPieces);
            } else {
                endGame('draw', 0);
            }
            return true;
        }
    }

    if (!hasComputerMoves() && currentPlayer === 1) {
        if (hasPlayerMoves()) {
            currentPlayer = 0;
            isComputerTurn = false;
            updateUI();
            showMessage('⚡ Ваш ход', '#4CAF50');
            startTimer();
            return false;
        } else {
            if (playerPieces > computerPieces) {
                endGame('player', playerPieces - computerPieces);
            } else if (computerPieces > playerPieces) {
                endGame('computer', computerPieces - playerPieces);
            } else {
                endGame('draw', 0);
            }
            return true;
        }
    }

    return false;
}

function hasPlayerMoves() {
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const p = board[i] && board[i][j] ? board[i][j] : null;
            if (p && p.player === 0) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = i + dr, nc = j + dc;
                        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                            if (isValidMove(p, i, j, nr, nc).valid) return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

function hasComputerMoves() {
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const p = board[i] && board[i][j] ? board[i][j] : null;
            if (p && p.player === 1) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = i + dr, nc = j + dc;
                        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                            const target = board[nr] && board[nr][nc] ? board[nr][nc] : null;
                            const isDiag = Math.abs(dr) === 1 && Math.abs(dc) === 1;
                            const isStraight = (dr === 0 || dc === 0) && Math.abs(dr) + Math.abs(dc) === 1;
                            if (isStraight && target === null) return true;
                            if (isDiag && target && target.player === 0) {
                                if (PREDATOR[p.color] === target.color) return true;
                                if (PREDATOR[target.color] === p.color) return true;
                                if (p.color === target.color) return true;
                            }
                        }
                    }
                }
            }
        }
    }
    return false;
}

// ============================================================
// ЗАВЕРШЕНИЕ ИГРЫ
// ============================================================
function endGame(winner, diff = 0) {
    if (isGameOver) return;
    isGameOver = true;
    gameActive = false;
    isAnimating = false;
    stopTimer();
    notifyGameplayStop();

    let message = '';
    let color = '';

    if (winner === 'player') {
        message = `🏅 Победил игрок! (разница: ${diff} очков) 🏅`;
        color = '#4CAF50';
        if (sounds.win) sounds.win();
        if (typeof hapticFeedback === 'function') {
            hapticFeedback('success');
        }
    } else if (winner === 'computer') {
        message = `💀 Победил компьютер! (разница: ${diff} очков) 💀`;
        color = '#f44336';
        if (sounds.lose) sounds.lose();
        if (typeof hapticFeedback === 'function') {
            hapticFeedback('error');
        }
    } else {
        message = `🤝 Ничья! (${diff} очков) 🤝`;
        color = '#ff9800';
        if (sounds.draw) sounds.draw();
        if (typeof hapticFeedback === 'function') {
            hapticFeedback('warning');
        }
    }

    showMessage(message, color);

    const gameInfo = document.querySelector('.game-info');
    if (gameInfo) {
        gameInfo.style.borderColor = color;
    }

    try {
        if (typeof saveGameResult === 'function') {
            if (winner === 'player') {
                saveGameResult(difficulty, 'player');
            } else if (winner === 'computer') {
                saveGameResult(difficulty, 'computer');
            }
        }
    } catch (e) {
        console.warn('Ошибка сохранения статистики:', e);
    }

    setTimeout(() => {
        if (typeof showBannerAd === 'function') {
            showBannerAd();
        }
    }, 1000);

    setTimeout(() => {
        location.reload();
    }, 2500);
}

// ============================================================
// MINIMAX ИИ (для HARD)
// ============================================================
function getAllMoves(boardState, player) {
    const moves = [];
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const p = boardState[i] && boardState[i][j] ? boardState[i][j] : null;
            if (!p || p.player !== player) continue;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = i + dr, nc = j + dc;
                    if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
                    const target = boardState[nr] && boardState[nr][nc] ? boardState[nr][nc] : null;
                    const isDiag = Math.abs(dr) === 1 && Math.abs(dc) === 1;
                    const isStraight = (dr === 0 || dc === 0) && Math.abs(dr) + Math.abs(dc) === 1;
                    if (isStraight && target === null) {
                        moves.push({ from: {row: i, col: j}, to: {row: nr, col: nc}, type: 'move', piece: p });
                    }
                    if (isDiag && target && target.player !== player) {
                        if (PREDATOR[p.color] === target.color) {
                            moves.push({ from: {row: i, col: j}, to: {row: nr, col: nc}, type: 'prey', piece: p, target });
                        }
                        if (PREDATOR[target.color] === p.color) {
                            moves.push({ from: {row: i, col: j}, to: {row: nr, col: nc}, type: 'capture', piece: p, target });
                        }
                        if (p.color === target.color) {
                            moves.push({ from: {row: i, col: j}, to: {row: nr, col: nc}, type: 'swap', piece: p, target });
                        }
                    }
                }
            }
        }
    }
    return moves;
}

function simulateMove(boardState, move) {
    const newBoard = boardState.map(row => row.slice());
    const piece = newBoard[move.from.row] && newBoard[move.from.row][move.from.col] ? newBoard[move.from.row][move.from.col] : null;

    if (move.type === 'capture') {
        newBoard[move.from.row][move.from.col] = null;
        return newBoard;
    } else {
        newBoard[move.to.row][move.to.col] = piece;
        newBoard[move.from.row][move.from.col] = null;
        return newBoard;
    }
}

function evaluateBoard(boardState) {
    let score = 0;
    let playerPieces = 0, computerPieces = 0;
    const colors = new Set();

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const p = boardState[i] && boardState[i][j] ? boardState[i][j] : null;
            if (!p) continue;
            colors.add(p.color);
            const centerBonus = (3.5 - Math.abs(i - 3.5)) * 2 + (3.5 - Math.abs(j - 3.5)) * 2;
            const baseValue = 10 + centerBonus;
            if (p.player === 1) {
                score += baseValue;
                computerPieces++;
            } else {
                score -= baseValue;
                playerPieces++;
            }
        }
    }

    if (colors.size > 1) {
        score += colors.size * 5;
    } else {
        if (computerPieces > playerPieces) {
            score += (computerPieces - playerPieces) * 20;
        } else {
            score -= (playerPieces - computerPieces) * 20;
        }
    }

    score += (computerPieces - playerPieces) * 5;
    return score;
}

function minimax(boardState, depth, alpha, beta, isMaximizing) {
    if (depth === 0) return evaluateBoard(boardState);
    const player = isMaximizing ? 1 : 0;
    const moves = getAllMoves(boardState, player);
    if (moves.length === 0) return isMaximizing ? -1000 : 1000;

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const newBoard = simulateMove(boardState, move);
            let evalScore = minimax(newBoard, depth - 1, alpha, beta, false);
            if (move.type === 'prey') evalScore += 50;
            else if (move.type === 'capture') evalScore -= 30;
            else if (move.type === 'swap') evalScore += 20;
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const newBoard = simulateMove(boardState, move);
            let evalScore = minimax(newBoard, depth - 1, alpha, beta, true);
            if (move.type === 'prey') evalScore -= 50;
            else if (move.type === 'capture') evalScore += 30;
            else if (move.type === 'swap') evalScore -= 20;
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function getBestMoveMinimax(depth = 3) {
    const moves = getAllMoves(board, 1);
    if (moves.length === 0) return null;
    let bestScore = -Infinity;
    const bestMoves = [];

    for (const move of moves) {
        const newBoard = simulateMove(board, move);
        let score = minimax(newBoard, depth - 1, -Infinity, Infinity, false);
        if (move.type === 'prey') score += 50;
        else if (move.type === 'capture') score -= 30;
        else if (move.type === 'swap') score += 20;

        if (score > bestScore) {
            bestScore = score;
            bestMoves.length = 0;
            bestMoves.push(move);
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// ============================================================
// ХОД КОМПЬЮТЕРА
// ============================================================
function computerMove() {
    if (!gameActive || currentPlayer !== 1 || isGameOver) return;

    saveUndoState();

    const computerPieces = [];
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const p = board[i] && board[i][j] ? board[i][j] : null;
            if (p && p.player === 1) computerPieces.push({ row: i, col: j, piece: p });
        }
    }
    if (computerPieces.length === 0) {
        checkGameOver();
        return;
    }

    let selectedMove = null;

    if (difficulty === 'easy') {
        const moves = getAllMoves(board, 1);
        if (moves.length === 0) {
            checkGameOver();
            return;
        }
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
    } else if (difficulty === 'medium') {
        const moves = getAllMoves(board, 1);
        if (moves.length === 0) {
            checkGameOver();
            return;
        }
        for (const move of moves) {
            let extra = 0;
            if (move.type === 'prey') extra = 100;
            else if (move.type === 'capture') extra = -50;
            else if (move.type === 'swap') extra = 30;

            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const cr = move.to.row + dr, cc = move.to.col + dc;
                    if (cr >= 0 && cr < 8 && cc >= 0 && cc < 8) {
                        const nearby = board[cr] && board[cr][cc] ? board[cr][cc] : null;
                        if (nearby && nearby.player === 0) {
                            if (PREDATOR[move.piece.color] === nearby.color) extra += 50;
                            if (PREDATOR[nearby.color] === move.piece.color) extra -= 40;
                        }
                    }
                }
            }
            move.score = extra;
        }
        moves.sort((a, b) => b.score - a.score);
        if (moves.length === 0) {
            checkGameOver();
            return;
        }
        const best = moves[0].score;
        const bestMoves = moves.filter(m => m.score === best);
        selectedMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    } else {
        selectedMove = getBestMoveMinimax(3);
        if (!selectedMove) {
            checkGameOver();
            return;
        }
    }

    if (!selectedMove) {
        checkGameOver();
        return;
    }

    const from = selectedMove.from;
    const to = selectedMove.to;
    const piece = board[from.row] && board[from.row][from.col] ? board[from.row][from.col] : null;
    board[from.row][from.col] = null;

    animateMove(from.row, from.col, to.row, to.col, piece, () => {
        if (selectedMove.type === 'prey') {
            board[to.row][to.col] = piece;
            computerScore++;
            if (sounds.capture) sounds.capture();
            if (typeof hapticFeedback === 'function') {
                hapticFeedback('heavy');
            }
            updateUI();
            showMessage(`🌸 Компьютер съел вашу шашку!`, '#f44336');

        } else if (selectedMove.type === 'capture') {
            const predator = board[to.row] && board[to.row][to.col] ? board[to.row][to.col] : null;
            board[from.row][from.col] = null;
            board[to.row][to.col] = predator;
            playerScore++;
            if (sounds.preyEaten) sounds.preyEaten();
            if (typeof hapticFeedback === 'function') {
                hapticFeedback('error');
            }
            updateUI();
            showMessage(`💚 Компьютер потерял шашку! Вы получаете +1 очко`, '#4CAF50');

        } else if (selectedMove.type === 'swap') {
            const targetPiece = board[to.row] && board[to.row][to.col] ? board[to.row][to.col] : null;
            board[to.row][to.col] = piece;
            board[from.row][from.col] = targetPiece;
            if (sounds.swap) sounds.swap();
            if (typeof hapticFeedback === 'function') {
                hapticFeedback('medium');
            }
            showMessage(`🔄 Компьютер поменялся шашками`, '#ff9800');

        } else {
            board[to.row][to.col] = piece;
            if (sounds.move) sounds.move();
            if (typeof hapticFeedback === 'function') {
                hapticFeedback('light');
            }
            showMessage(`⬜ Компьютер сделал ход`, '#2196F3');
        }

        draw();

        if (!checkGameOver() && gameActive && !isGameOver) {
            currentPlayer = 0;
            isComputerTurn = false;
            updateUI();
            showMessage('⚡ Ваш ход. Выберите шашку', '#4CAF50');
            startTimer();
        }
    });
}

// ============================================================
// РАССТАНОВКА
// ============================================================
function startPlacementEasy() {
    waitingForPlacement = true;
    placementRemaining = 12;
    const panel = document.getElementById('placementPanel');
    if (panel) panel.style.display = 'block';
    const container = document.getElementById('colorSelector');
    if (!container) return;
    container.innerHTML = '';

    const cellSize = window._cellSize || 50;
    const hintSize = Math.max(cellSize, 28);
    const fontSize = Math.max(hintSize * 0.45, 12);

    for (const color of COLORS) {
        const btn = document.createElement('button');
        btn.className = 'color-btn';
        btn.dataset.color = color;
        btn.style.background = 'transparent';
        btn.style.border = 'none';
        btn.style.position = 'relative';
        btn.style.padding = '0';
        btn.style.cursor = 'pointer';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.transition = 'all 0.2s ease';
        btn.style.flexShrink = '0';
        btn.style.width = hintSize + 'px';
        btn.style.height = hintSize + 'px';

        const miniCanvas = document.createElement('canvas');
        const size = Math.min(hintSize, 64);
        miniCanvas.width = size;
        miniCanvas.height = size;
        miniCanvas.style.width = '100%';
        miniCanvas.style.height = '100%';
        miniCanvas.style.display = 'block';
        miniCanvas.style.borderRadius = '50%';
        miniCanvas.style.border = Math.max(1, size * 0.04) + 'px solid rgba(255,255,255,0.08)';
        miniCanvas.style.transition = 'all 0.2s ease';
        miniCanvas.style.boxSizing = 'border-box';
        btn.appendChild(miniCanvas);

        redrawHintPiece(miniCanvas, color, size, fontSize);

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            initAudio();
            if (sounds.click) sounds.click();
            currentPlacementColor = color;
            document.querySelectorAll('.color-btn, .medium-piece').forEach(b => {
                b.classList.remove('active');
                const canvasEl = b.querySelector('canvas');
                if (canvasEl) {
                    canvasEl.style.boxShadow = 'none';
                    canvasEl.style.transform = 'scale(1)';
                    canvasEl.style.borderColor = 'rgba(255,255,255,0.08)';
                }
            });
            this.classList.add('active');
            const canvasEl = this.querySelector('canvas');
            if (canvasEl) {
                canvasEl.style.boxShadow = '0 0 16px rgba(74, 144, 217, 0.25)';
                canvasEl.style.transform = 'scale(1.05)';
                canvasEl.style.borderColor = '#4A90D9';
            }
            showMessage(`Выбран цвет: ${getColorName(color)}. Выберите клетку (осталось ${placementRemaining})`, '#4CAF50');
        });

        container.appendChild(btn);
    }
    showMessage(`Выберите цвет шашки (осталось ${placementRemaining})`, '#2196F3');
    draw();
}

function startPlacementMedium() {
    waitingForPlacement = true;
    placementRemaining = 12;
    placementIndex = 0;
    placementColors = [];
    for (let i = 0; i < 12; i++) placementColors.push(COLORS[Math.floor(Math.random() * 3)]);
    currentPlacementColor = placementColors[0];
    const panel = document.getElementById('placementPanel');
    if (panel) panel.style.display = 'block';
    const selector = document.getElementById('colorSelector');
    if (selector) selector.style.display = 'none';
    const mediumPlace = document.getElementById('mediumPlace');
    if (mediumPlace) mediumPlace.style.display = 'flex';
    updateMediumDisplay();
    draw();
}

function updateMediumDisplay() {
    if (placementIndex < 12) {
        const color = placementColors[placementIndex];
        const mediumPiece = document.getElementById('mediumPiece');
        if (mediumPiece) {
            const cellSize = window._cellSize || 50;
            const hintSize = Math.max(cellSize, 28);
            const fontSize = Math.max(hintSize * 0.45, 12);

            mediumPiece.innerHTML = '';
            mediumPiece.style.background = 'transparent';
            mediumPiece.style.border = 'none';
            mediumPiece.style.padding = '0';
            mediumPiece.style.display = 'flex';
            mediumPiece.style.alignItems = 'center';
            mediumPiece.style.justifyContent = 'center';
            mediumPiece.style.flexShrink = '0';
            mediumPiece.style.width = hintSize + 'px';
            mediumPiece.style.height = hintSize + 'px';

            const miniCanvas = document.createElement('canvas');
            const size = Math.min(hintSize, 64);
            miniCanvas.width = size;
            miniCanvas.height = size;
            miniCanvas.style.width = '100%';
            miniCanvas.style.height = '100%';
            miniCanvas.style.display = 'block';
            miniCanvas.style.borderRadius = '50%';
            miniCanvas.style.border = Math.max(1, size * 0.04) + 'px solid #4A90D9';
            miniCanvas.style.boxShadow = '0 0 16px rgba(74, 144, 217, 0.25)';
            miniCanvas.style.transform = 'scale(1.05)';
            miniCanvas.style.transition = 'all 0.2s ease';
            miniCanvas.style.boxSizing = 'border-box';
            mediumPiece.appendChild(miniCanvas);

            redrawHintPiece(miniCanvas, color, size, fontSize);
        }
        showMessage(`Поставьте ${getColorName(color)} шашку на свободную клетку (осталось ${12 - placementIndex})`, '#4CAF50');
    }
}

function finishPlacement() {
    waitingForPlacement = false;
    const panel = document.getElementById('placementPanel');
    if (panel) panel.style.display = 'none';

    if (difficulty === 'medium' && computerBoardBackup) {
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                if (computerBoardBackup[i][j] && computerBoardBackup[i][j].player === 1) {
                    board[i][j] = computerBoardBackup[i][j];
                }
            }
        }
    }

    gameActive = true;
    currentPlayer = 0;
    isComputerTurn = false;
    notifyGameplayStart();
    updateUI();
    draw();
    showMessage('Расстановка завершена! Ваш ход', '#4CAF50');
    startTimer();

    // ✅ Игра готова к взаимодействию — отправляем Game Ready (п. 1.19)
    setTimeout(() => {
        onGameFullyReady();
    }, 200);
}

function handlePlacement(row, col) {
    if (!waitingForPlacement) return false;
    if (row < 5 || row > 7) {
        showMessage('Шашки можно ставить только в свои ряды (5-7)', '#f44336');
        if (sounds.error) sounds.error();
        return false;
    }
    if ((row + col) % 2 !== 1) {
        showMessage('Шашки ставятся только на тёмные клетки', '#f44336');
        if (sounds.error) sounds.error();
        return false;
    }
    if (board[row] && board[row][col] !== null) {
        showMessage('Эта клетка уже занята', '#f44336');
        if (sounds.error) sounds.error();
        return false;
    }
    if (difficulty === 'easy') {
        if (!currentPlacementColor) {
            showMessage('Сначала выберите цвет шашки', '#f44336');
            if (sounds.error) sounds.error();
            return false;
        }
        board[row][col] = { color: currentPlacementColor, player: 0 };
        placementRemaining--;
        if (sounds.move) sounds.move();
        if (placementRemaining > 0) {
            showMessage(`Выберите цвет для следующей шашки (осталось ${placementRemaining})`, '#2196F3');
            document.querySelectorAll('.color-btn, .medium-piece').forEach(b => {
                b.classList.remove('active');
                const canvasEl = b.querySelector('canvas');
                if (canvasEl) {
                    canvasEl.style.boxShadow = 'none';
                    canvasEl.style.transform = 'scale(1)';
                    canvasEl.style.borderColor = 'rgba(255,255,255,0.08)';
                }
            });
            currentPlacementColor = null;
        } else {
            finishPlacement();
        }
    } else if (difficulty === 'medium') {
        board[row][col] = { color: currentPlacementColor, player: 0 };
        placementIndex++;
        if (sounds.move) sounds.move();
        if (placementIndex < 12) {
            currentPlacementColor = placementColors[placementIndex];
            updateMediumDisplay();
            showMessage(`Поставьте ${getColorName(currentPlacementColor)} шашку на свободную клетку (осталось ${12 - placementIndex})`, '#4CAF50');
            draw();
        } else {
            finishPlacement();
        }
    }
    draw();
    return true;
}

// ============================================================
// ОБРАБОТКА КЛИКОВ
// ============================================================
function handleClick(e) {
    if (!gameActive && !waitingForPlacement) return;
    if (isAnimating || isGameOver) return;

    initAudio();

    const canvasEl = document.getElementById('boardCanvas');
    if (!canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const cell = canvasEl.width / 8;
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    if (row < 0 || row >= 8 || col < 0 || col >= 8) return;

    if (waitingForPlacement) {
        handlePlacement(row, col);
        return;
    }

    if (currentPlayer !== 0) {
        showMessage('⏳ Сейчас ход компьютера...', '#ff9800');
        if (sounds.error) sounds.error();
        return;
    }

    const piece = board[row] && board[row][col] ? board[row][col] : null;

    if (selectedPiece === null) {
        if (piece && piece.player === 0) {
            selectedPiece = { row, col, piece };
            validMoves = calculateValidMoves(row, col);
            if (sounds.select) sounds.select();

            const captures = validMoves.filter(m => m.type === 'capture').length;
            const preys = validMoves.filter(m => m.type === 'prey').length;
            const swaps = validMoves.filter(m => m.type === 'swap').length;
            const moves = validMoves.filter(m => m.type === 'move').length;

            let msg = `Выбрана ${getColorName(piece.color)} шашка. `;
            if (validMoves.length === 0) {
                msg += 'Нет доступных ходов';
            } else {
                const parts = [];
                if (preys > 0) parts.push(`💚 съесть ${preys}`);
                if (captures > 0) parts.push(`🌸 опасно ${captures}`);
                if (swaps > 0) parts.push(`🔄 поменяться ${swaps}`);
                if (moves > 0) parts.push(`⬜ ход ${moves}`);
                msg += parts.join(', ');
            }
            showMessage(msg, '#4CAF50');
            draw();
        } else {
            showMessage('👆 Выберите свою шашку', '#f44336');
            if (sounds.error) sounds.error();
        }
    } else {
        const move = validMoves.find(m => m.row === row && m.col === col);
        if (move) {
            makeMoveAnimated(selectedPiece.row, selectedPiece.col, row, col, move);
        } else if (piece && piece.player === 0 && !(row === selectedPiece.row && col === selectedPiece.col)) {
            selectedPiece = { row, col, piece };
            validMoves = calculateValidMoves(row, col);
            if (sounds.select) sounds.select();
            draw();
        } else if (row === selectedPiece.row && col === selectedPiece.col) {
            selectedPiece = null;
            validMoves = [];
            draw();
        } else {
            selectedPiece = null;
            validMoves = [];
            showMessage('❌ Недопустимый ход', '#f44336');
            if (sounds.error) sounds.error();
            draw();
        }
    }
}

// ============================================================
// ОБРАБОТЧИКИ КНОПОК
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const soundBtn = document.getElementById('soundBtn');
    if (soundBtn) {
        soundBtn.addEventListener('click', toggleSound);
    }

    const exitBtn = document.getElementById('exitBtn');
    if (exitBtn) {
        exitBtn.addEventListener('click', function() {
            if (sounds.click) sounds.click();
            notifyGameplayStop();
            stopTimer();
            location.href = 'start.html';
        });
    }

    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
        undoBtn.addEventListener('click', function() {
            if (sounds.click) sounds.click();
            undoLastMove();
        });
    }

    setTimeout(applyAdaptiveScaling, 100);
});

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================
function initGame() {
    console.log('🎮 initGame() вызван');

    difficulty = localStorage.getItem('tripleColorDifficulty') || 'medium';
    console.log('🎮 Инициализация игры со сложностью:', difficulty);

    isGameOver = false;
    gameplayStarted = false;
    gameFullyReady = false;
    isComputerTurn = false;
    undoHistory = [];
    undoCount = 0;

    try {
        const canvasEl = document.getElementById('boardCanvas');
        if (!canvasEl) {
            console.error('❌ Canvas не найден!');
            showMessage('⚠️ Ошибка инициализации. Перезагрузите страницу.', '#f44336');
            return;
        }

        initBoard();
        resizeCanvas();
        updateAllSizes();

        if (!board || board.length === 0) {
            console.error('❌ Доска не инициализирована');
            showMessage('⚠️ Ошибка инициализации доски. Перезагрузите страницу.', '#f44336');
            return;
        }

        if (!navigator.onLine) {
            const statusMsg = document.getElementById('gameMessage');
            if (statusMsg) {
                statusMsg.textContent = '📶 Офлайн-режим. Игра работает локально.';
                statusMsg.style.color = '#ff9800';
                statusMsg.classList.add('warning');
            }
        }

        setTimeout(() => {
            try {
                if (difficulty === 'easy') {
                    const compPos = getComputerPositions();
                    const order = ['alpha', 'omega', 'delta'];
                    let idx = 0;
                    for (const pos of compPos) {
                        board[pos.row][pos.col] = { color: order[idx % 3], player: 1 };
                        idx++;
                    }
                    startPlacementEasy();
                } else if (difficulty === 'medium') {
                    const compPos = getComputerPositions();
                    const order = ['alpha', 'omega', 'delta'];
                    let idx = 0;
                    for (const pos of compPos) {
                        board[pos.row][pos.col] = { color: order[idx % 3], player: 1 };
                        idx++;
                    }
                    computerBoardBackup = JSON.parse(JSON.stringify(board));
                    for (let i = 0; i < 8; i++) {
                        for (let j = 0; j < 8; j++) {
                            if (board[i][j] && board[i][j].player === 1) board[i][j] = null;
                        }
                    }
                    startPlacementMedium();
                } else {
                    const compPos = getComputerPositions();
                    const shuffledComp = [...compPos];
                    for (let i = shuffledComp.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffledComp[i], shuffledComp[j]] = [shuffledComp[j], shuffledComp[i]];
                    }
                    const compColors = [];
                    for (let i = 0; i < 12; i++) compColors.push(COLORS[Math.floor(Math.random() * 3)]);
                    for (let i = 0; i < 12; i++) {
                        board[shuffledComp[i].row][shuffledComp[i].col] = { color: compColors[i], player: 1 };
                    }

                    const playerPos = getPlayerPositions();
                    const shuffledPlayer = [...playerPos];
                    for (let i = shuffledPlayer.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffledPlayer[i], shuffledPlayer[j]] = [shuffledPlayer[j], shuffledPlayer[i]];
                    }
                    const playerColors = [];
                    for (let i = 0; i < 12; i++) playerColors.push(COLORS[Math.floor(Math.random() * 3)]);
                    for (let i = 0; i < 12; i++) {
                        board[shuffledPlayer[i].row][shuffledPlayer[i].col] = { color: playerColors[i], player: 0 };
                    }

                    gameActive = true;
                    currentPlayer = 0;
                    isComputerTurn = false;
                    notifyGameplayStart();
                    showMessage('🧩 Игра началась! Ваш ход', '#4CAF50');
                    updateUI();
                    draw();
                    startTimer();

                    // ✅ Игра готова — отправляем Game Ready
                    setTimeout(() => {
                        onGameFullyReady();
                    }, 200);
                }
                console.log('✅ Игра инициализирована со сложностью:', difficulty);
            } catch (e) {
                console.error('❌ Ошибка инициализации игры:', e);
                showMessage('⚠️ Ошибка инициализации. Перезагрузите страницу.', '#f44336');
            }
        }, 100);
    } catch (e) {
        console.error('❌ Критическая ошибка initGame:', e);
        showMessage('⚠️ Критическая ошибка. Перезагрузите страницу.', '#f44336');
    }
}

// ============================================================
// ОТСЛЕЖИВАНИЕ СТАТУСА ИНТЕРНЕТА
// ============================================================
window.addEventListener('online', () => {
    const statusMsg = document.getElementById('gameMessage');
    if (statusMsg && !isGameOver) {
        statusMsg.textContent = '🟢 Интернет восстановлен. Игра продолжается.';
        statusMsg.style.color = '#4CAF50';
        statusMsg.classList.add('success');
        setTimeout(() => {
            if (!isGameOver && gameActive) {
                statusMsg.textContent = currentPlayer === 0 ? '⚡ Ваш ход' : '🤖 Ход компьютера...';
                statusMsg.style.color = '#ff9800';
            }
        }, 3000);
    }
});

window.addEventListener('offline', () => {
    const statusMsg = document.getElementById('gameMessage');
    if (statusMsg && !isGameOver) {
        statusMsg.textContent = '📶 Офлайн-режим. Игра работает локально.';
        statusMsg.style.color = '#ff9800';
        statusMsg.classList.add('warning');
    }
});

// ============================================================
// СОБЫТИЯ
// ============================================================
if (canvas) {
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
            const click = new MouseEvent('click', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            handleClick(click);
        }
    }, { passive: false });
}

window.addEventListener('resize', function() {
    resizeCanvas();
    applyAdaptiveScaling();
});

window.addEventListener('load', function() {
    setTimeout(() => {
        try {
            initGame();
            applyAdaptiveScaling();
        } catch (e) {
            console.warn('⚠️ Ошибка инициализации игры:', e);
            const statusMsg = document.getElementById('gameMessage');
            if (statusMsg) {
                statusMsg.textContent = '⚠️ Произошла ошибка. Перезагрузите страницу.';
                statusMsg.style.color = '#f44336';
                statusMsg.classList.add('error');
            }
        }
        console.log('✅ Игра запущена!');
    }, 200);
});

// ============================================================
// ФИКС ДЛЯ МОБИЛЬНЫХ КНОПОК
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const allButtons = document.querySelectorAll('button, .icon-btn, .btn-control, .btn-scroll');
    allButtons.forEach(btn => {
        btn.style.pointerEvents = 'auto';
        btn.style.touchAction = 'manipulation';
        btn.style.position = 'relative';
        btn.style.zIndex = '1000';
        btn.style.cursor = 'pointer';
    });

    const headerButtons = document.querySelectorAll('.header .icon-btn, .header button');
    headerButtons.forEach(btn => {
        btn.style.pointerEvents = 'auto';
        btn.style.zIndex = '10000';
    });

    const canvasEl = document.getElementById('boardCanvas');
    if (canvasEl) {
        canvasEl.style.pointerEvents = 'auto';
        canvasEl.style.zIndex = '10';
    }

    console.log('✅ Мобильные кнопки принудительно активированы');
});

console.log('✅ Game.js загружен и готов к работе');