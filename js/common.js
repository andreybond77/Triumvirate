// ============================================================
// ОБЩИЕ ФУНКЦИИ ДЛЯ ВСЕХ СТРАНИЦ + PWA
// ============================================================

let ysdk = null;
let isAuthenticated = false;
let playerName = 'Игрок';
let currentLanguage = 'ru';
let sdkInitialized = false;
let isOnline = navigator.onLine;
let gameReadyCalled = false;
let languageDetermined = false;
let sdkInitPromise = null;

// Глобальная переменная для ysdk (доступна из game.js)
window.ysdk = null;

// ============================================================
// PWA (Progressive Web App)
// ============================================================

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('✅ Service Worker зарегистрирован'))
        .catch((err) => console.warn('⚠️ Ошибка SW:', err));
}

window.addEventListener('online', () => {
    isOnline = true;
    console.log('🟢 Интернет восстановлен');
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log('🔴 Интернет потерян');
});

// ============================================================
// 1. БЛОКИРОВКА КОНТЕКСТНОГО МЕНЮ И ВЫДЕЛЕНИЯ
// ============================================================

document.addEventListener('contextmenu', function(e) {
    const target = e.target;
    if (target.closest('.game, .game-container, .board-wrap, .board, canvas, .start-container, .difficulty-container, .stats-container, .rules-container, .index-flex-container')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
    if (target.tagName === 'CANVAS') {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}, { passive: false });

document.addEventListener('selectstart', function(e) {
    const target = e.target;
    if (target.closest('.game, .game-container, .board-wrap, .board, canvas, .start-container, .difficulty-container, .stats-container, .rules-container, .index-flex-container')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
    if (target.tagName === 'CANVAS') {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}, { passive: false });

document.addEventListener('mousedown', function(e) {
    if (e.target.tagName === 'CANVAS') {
        e.preventDefault();
    }
});

document.addEventListener('dblclick', function(e) {
    if (e.target.closest('.game, .game-container, .board-wrap, .board, canvas')) {
        e.preventDefault();
    }
    if (e.target.tagName === 'CANVAS') {
        e.preventDefault();
    }
});

// ============================================================
// 2. БЛОКИРОВКА ПРОКРУТКИ
// ============================================================

document.addEventListener('touchmove', function(e) {
    const target = e.target;
    if (target.closest('.game, .game-container, .board-wrap, .board, canvas, .start-container, .difficulty-container, .stats-container, .rules-container')) {
        e.preventDefault();
    }
    if (target.tagName === 'CANVAS') {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

// ============================================================
// 3. ИСПРАВЛЕНИЕ ВЫСОТЫ ДЛЯ МОБИЛЬНЫХ
// ============================================================

function setVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', setVH);
window.addEventListener('orientationchange', () => {
    setTimeout(setVH, 300);
});
setVH();

// ============================================================
// 4. ПОЛНОЭКРАННЫЙ РЕЖИМ
// ============================================================

function requestFullscreenOnMobile() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
    }
}

// ============================================================
// 5. АВТООПРЕДЕЛЕНИЕ ЯЗЫКА (п.2.14) — FALLBACK ПО БРАУЗЕРУ
// ============================================================

function determineLanguageSync() {
    if (languageDetermined) return currentLanguage;

    const browserLang = navigator.language || navigator.userLanguage || 'ru';
    const lang = browserLang.split('-')[0];
    const supportedLangs = ['ru', 'en', 'kk', 'uk'];
    const finalLang = supportedLangs.includes(lang) ? lang : 'ru';

    currentLanguage = finalLang;
    languageDetermined = true;
    console.log(`🌐 Язык установлен по умолчанию (браузер): ${finalLang}`);
    applyLanguage(finalLang);
    return finalLang;
}

// ============================================================
// 6. SDK — ИНИЦИАЛИЗАЦИЯ
// ВАЖНО: язык определяется СРАЗУ после YaGames.init(),
// GameReady отсюда НЕ отправляется (см. game.js → onGameFullyReady)
// ============================================================

async function initSDK() {
    if (sdkInitialized) return true;
    if (sdkInitPromise) return sdkInitPromise;

    sdkInitPromise = (async () => {
        try {
            if (typeof YaGames === 'undefined') {
                console.warn('⚠️ SDK Яндекс Игр не загружен');
                showSDKFallback('SDK не загружен. Проверьте подключение /sdk.js');
                if (!languageDetermined) {
                    determineLanguageSync();
                }
                return false;
            }

            console.log('🔄 Инициализация SDK...');

            window.ysdk = await YaGames.init();
            ysdk = window.ysdk;
            sdkInitialized = true;
            console.log('✅ SDK Яндекс Игр инициализирован');

            // ============================================================
            // АВТООПРЕДЕЛЕНИЕ ЯЗЫКА ИЗ SDK (п. 2.14)
            // Выполняется СРАЗУ после init() и ДО отправки GameReady
            // ============================================================
            try {
                const lang = window.ysdk.environment.i18n.lang;
                if (lang) {
                    currentLanguage = lang;
                    languageDetermined = true;
                    console.log(`🌐 Язык определён из SDK: ${lang}`);
                    applyLanguage(lang);
                } else if (!languageDetermined) {
                    determineLanguageSync();
                }
            } catch (e) {
                console.warn('⚠️ Не удалось определить язык из SDK, использую браузерный:', e);
                if (!languageDetermined) {
                    determineLanguageSync();
                }
            }

            // ============================================================
            // ПОДПИСКА НА СОБЫТИЯ ПАУЗЫ/ВОЗОБНОВЛЕНИЯ
            // ============================================================
            try {
                ysdk.on('game_api_pause', function() {
                    console.log('⏸️ Game Pause (game_api_pause)');
                    if (window._audioCtx && window._audioCtx.state === 'running') {
                        window._audioCtx.suspend();
                    }
                    if (typeof window.notifyGameplayStop === 'function') {
                        window.notifyGameplayStop();
                    }
                    if (typeof window.stopTimer === 'function') {
                        window.stopTimer();
                    }
                });

                ysdk.on('game_api_resume', function() {
                    console.log('▶️ Game Resume (game_api_resume)');
                    if (window._audioCtx && window._audioCtx.state === 'suspended') {
                        window._audioCtx.resume();
                    }
                    if (typeof window.notifyGameplayStart === 'function') {
                        window.notifyGameplayStart();
                    }
                    if (typeof window.startTimer === 'function') {
                        window.startTimer();
                    }
                });

                console.log('✅ Подписка на события паузы/возобновления выполнена');
            } catch (e) {
                console.warn('⚠️ Ошибка подписки на события паузы:', e);
            }

            // ============================================================
            // GAME READY ЗДЕСЬ НЕ ОТПРАВЛЯЕМ!
            // Он будет отправлен из game.js → onGameFullyReady(),
            // когда игра реально готова к взаимодействию (п. 1.19)
            // ============================================================

            return true;
        } catch (e) {
            console.warn('⚠️ Ошибка инициализации SDK:', e);
            showSDKFallback('Ошибка инициализации SDK');

            if (!languageDetermined) {
                determineLanguageSync();
            }

            return false;
        }
    })();

    return sdkInitPromise;
}

// ============================================================
// 7. GAME READY API — ВЫЗЫВАЕТСЯ ИЗ game.js
// ============================================================

function sendGameReadyImmediate() {
    if (gameReadyCalled) {
        console.log('ℹ️ GameReady уже был отправлен');
        return true;
    }

    try {
        if (typeof window.ysdk === 'undefined' || !window.ysdk) {
            console.warn('⚠️ ysdk не инициализирован, GameReady не отправлен');
            return false;
        }

        // Способ 1: через LoadingAPI (рекомендованный)
        if (window.ysdk.features && typeof window.ysdk.features.LoadingAPI !== 'undefined') {
            window.ysdk.features.LoadingAPI.ready();
            gameReadyCalled = true;
            console.log('✅ Game Ready (LoadingAPI) отправлен');
            return true;
        }

        // Способ 2: через ysdk.ready (fallback)
        if (typeof window.ysdk.ready === 'function') {
            window.ysdk.ready();
            gameReadyCalled = true;
            console.log('✅ Game Ready (ysdk.ready) отправлен');
            return true;
        }

        console.warn('⚠️ Game Ready API не найден');
        return false;
    } catch (e) {
        console.warn('⚠️ Game Ready ошибка:', e);
        return false;
    }
}

// ============================================================
// 8. ПРИМЕНЕНИЕ ПЕРЕВОДОВ
// ============================================================

function applyLanguage(lang) {
    const translations = {
        ru: {
            player: 'Игрок',
            computer: 'Компьютер',
            yourTurn: 'Ваш ход',
            computerTurn: 'Ход компьютера',
            gameOver: 'Игра окончена',
            newGame: 'Новая игра',
            back: 'Назад',
            rules: 'Правила',
            statistics: 'Статистика',
            difficulty: 'Сложность',
            menu: 'Меню',
            startGame: 'Начать игру',
            chooseDifficulty: 'Выберите сложность',
            loading: 'Загрузка игры...',
            selectPiece: 'Выберите шашку',
            yourMove: 'Ваш ход',
            computerMove: 'Ход компьютера'
        },
        en: {
            player: 'Player',
            computer: 'Computer',
            yourTurn: 'Your turn',
            computerTurn: 'Computer turn',
            gameOver: 'Game over',
            newGame: 'New game',
            back: 'Back',
            rules: 'Rules',
            statistics: 'Statistics',
            difficulty: 'Difficulty',
            menu: 'Menu',
            startGame: 'Start game',
            chooseDifficulty: 'Choose difficulty',
            loading: 'Loading game...',
            selectPiece: 'Select a piece',
            yourMove: 'Your turn',
            computerMove: 'Computer turn'
        },
        kk: {
            player: 'Ойыншы',
            computer: 'Компьютер',
            yourTurn: 'Сіздің кезегіңіз',
            computerTurn: 'Компьютер кезегі',
            gameOver: 'Ойын аяқталды',
            newGame: 'Жаңа ойын',
            back: 'Артқа',
            rules: 'Ережелер',
            statistics: 'Статистика',
            difficulty: 'Қиындық',
            menu: 'Мәзір',
            startGame: 'Ойын бастау',
            chooseDifficulty: 'Қиындықты таңдаңыз',
            loading: 'Ойын жүктелуде...',
            selectPiece: 'Шашканы таңдаңыз',
            yourMove: 'Сіздің кезегіңіз',
            computerMove: 'Компьютер кезегі'
        },
        uk: {
            player: 'Гравець',
            computer: 'Комп\'ютер',
            yourTurn: 'Ваш хід',
            computerTurn: 'Хід комп\'ютера',
            gameOver: 'Гру закінчено',
            newGame: 'Нова гра',
            back: 'Назад',
            rules: 'Правила',
            statistics: 'Статистика',
            difficulty: 'Складність',
            menu: 'Меню',
            startGame: 'Почати гру',
            chooseDifficulty: 'Виберіть складність',
            loading: 'Завантаження гри...',
            selectPiece: 'Виберіть шашку',
            yourMove: 'Ваш хід',
            computerMove: 'Хід комп\'ютера'
        }
    };

    const t = translations[lang] || translations.ru;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key]) {
            el.textContent = t[key];
        }
    });

    const loadingStatus = document.querySelector('.loading-status');
    if (loadingStatus && !loadingStatus.dataset.translated) {
        loadingStatus.textContent = t.loading || 'Загрузка игры...';
        loadingStatus.dataset.translated = 'true';
    }
}

function showSDKFallback(message) {
    const msg = document.getElementById('gameMessage');
    if (msg) {
        msg.textContent = `ℹ️ ${message || 'Игра работает в локальном режиме.'}`;
        msg.style.color = '#ff9800';
        msg.classList.add('warning');
    }
}

// ============================================================
// 9. СТАТИСТИКА
// ============================================================

const DEFAULT_STATS = {
    easy: { player: 0, computer: 0, games: 0 },
    medium: { player: 0, computer: 0, games: 0 },
    hard: { player: 0, computer: 0, games: 0 },
    total: { player: 0, computer: 0, games: 0 }
};

function loadStats() {
    try {
        const s = JSON.parse(localStorage.getItem('tripleColorStats') || 'null');
        return s && s.total ? s : JSON.parse(JSON.stringify(DEFAULT_STATS));
    } catch {
        return JSON.parse(JSON.stringify(DEFAULT_STATS));
    }
}

function saveStats(stats) {
    localStorage.setItem('tripleColorStats', JSON.stringify(stats));
}

function saveGameResult(difficulty, winner) {
    const stats = loadStats();
    if (!stats[difficulty]) {
        stats[difficulty] = { player: 0, computer: 0, games: 0 };
    }
    stats[difficulty].games++;
    stats[difficulty][winner]++;
    stats.total.games++;
    stats.total[winner]++;
    saveStats(stats);
}

function renderStats() {
    const s = loadStats();
    const elements = {
        playerWins: 'playerWins',
        computerWins: 'computerWins',
        totalGames: 'totalGames',
        easyPlayer: 'easyPlayer',
        easyComputer: 'easyComputer',
        easyTotal: 'easyTotal',
        mediumPlayer: 'mediumPlayer',
        mediumComputer: 'mediumComputer',
        mediumTotal: 'mediumTotal',
        hardPlayer: 'hardPlayer',
        hardComputer: 'hardComputer',
        hardTotal: 'hardTotal'
    };

    for (const [key, id] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) {
            if (key === 'playerWins') el.textContent = s.total.player;
            else if (key === 'computerWins') el.textContent = s.total.computer;
            else if (key === 'totalGames') el.textContent = s.total.games;
            else if (key.startsWith('easy')) {
                const type = key.replace('easy', '').toLowerCase();
                if (type === 'player') el.textContent = s.easy.player;
                else if (type === 'computer') el.textContent = s.easy.computer;
                else if (type === 'total') el.textContent = s.easy.games;
            } else if (key.startsWith('medium')) {
                const type = key.replace('medium', '').toLowerCase();
                if (type === 'player') el.textContent = s.medium.player;
                else if (type === 'computer') el.textContent = s.medium.computer;
                else if (type === 'total') el.textContent = s.medium.games;
            } else if (key.startsWith('hard')) {
                const type = key.replace('hard', '').toLowerCase();
                if (type === 'player') el.textContent = s.hard.player;
                else if (type === 'computer') el.textContent = s.hard.computer;
                else if (type === 'total') el.textContent = s.hard.games;
            }
        }
    }
}

// ============================================================
// 10. ОБНОВЛЕНИЕ БЕЙДЖИКА СЛОЖНОСТИ
// ============================================================

function updateDifficultyBadge() {
    const difficulty = localStorage.getItem('tripleColorDifficulty') || 'medium';
    const badges = {
        easy: '🟢 Лёгкая',
        medium: '🟡 Средняя',
        hard: '🔴 Сложная'
    };

    const badge = document.getElementById('difficultyBadge');
    if (badge) {
        badge.textContent = badges[difficulty] || '🟡 Средняя';
        badge.classList.remove('loading');
    }
}

// ============================================================
// 11. РЕКЛАМА (РСЯ)
// ============================================================

let bannerShown = false;

function showBannerAd() {
    if (!window.ysdk || !sdkInitialized) {
        console.log('ℹ️ SDK не инициализирован, баннерная реклама недоступна');
        return;
    }

    if (bannerShown) return;
    bannerShown = true;

    try {
        const container = document.getElementById('bannerAdContainer');
        if (!container) return;

        container.innerHTML = '';

        window.ysdk.features.AdBanner?.show({
            container: container,
            type: 'stick'
        });
        console.log('📢 Баннерная реклама показана');
    } catch (e) {
        console.warn('⚠️ Ошибка показа баннерной рекламы:', e);
        bannerShown = false;
    }
}

// ============================================================
// 12. ПАУЗА ЗВУКА ПРИ СВОРАЧИВАНИИ
// ============================================================

document.addEventListener('visibilitychange', () => {
    const audioCtx = window._audioCtx;
    if (!audioCtx) return;

    if (document.hidden) {
        if (audioCtx.state === 'running') {
            audioCtx.suspend();
            console.log('🔇 Звук остановлен (страница свернута)');
        }
        if (typeof window.notifyGameplayStop === 'function') {
            window.notifyGameplayStop();
        }
        if (typeof window.stopTimer === 'function') {
            window.stopTimer();
        }
    } else {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
            console.log('🔊 Звук возобновлен (страница активна)');
        }
        if (typeof window.notifyGameplayStart === 'function') {
            window.notifyGameplayStart();
        }
        if (typeof window.startTimer === 'function') {
            window.startTimer();
        }
    }
});

// ============================================================
// 13. ЗАПУСК
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 DOMContentLoaded: запуск инициализации...');

    // 1. МГНОВЕННО определяем язык (синхронно, браузерный fallback)
    determineLanguageSync();

    // 2. Запрашиваем полноэкранный режим
    setTimeout(requestFullscreenOnMobile, 1000);

    // 3. Инициализируем SDK (асинхронно).
    //    Язык из SDK будет применён ВНУТРИ initSDK() ДО отправки GameReady.
    initSDK().then((success) => {
        if (success) {
            console.log('✅ SDK успешно инициализирован');
        } else {
            console.log('ℹ️ SDK не инициализирован');
        }

        updateDifficultyBadge();

        if (document.getElementById('bannerAdContainer')) {
            setTimeout(() => {
                showBannerAd();
            }, 3000);
        }
    });
});

window.addEventListener('load', function() {
    if (!languageDetermined) {
        determineLanguageSync();
    }

    if (!sdkInitialized) {
        console.log('🔄 Повторная попытка инициализации SDK (window.load)...');
        initSDK().then(() => {
            updateDifficultyBadge();
        });
    }
});

// Экспортируем функции
window.determineLanguageSync = determineLanguageSync;
window.applyLanguage = applyLanguage;
window.currentLanguage = currentLanguage;
window.sendGameReadyImmediate = sendGameReadyImmediate;
window.initSDK = initSDK;

console.log('✅ Common.js загружен и готов к работе');