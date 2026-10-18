// ============================================================
// БЫСТРЫЕ ИСПРАВЛЕНИЯ ДЛЯ МОДЕРАЦИИ + МОБИЛЬНЫХ КНОПОК
// ============================================================

(function() {
    'use strict';
    
    // 1. Блокировка контекстного меню на всех элементах игры
    document.addEventListener('contextmenu', function(e) {
        const target = e.target;
        if (target.closest('.game, .game-container, .board-wrap, .board, canvas, .start-container, .difficulty-container, .stats-container, .rules-container, .index-flex-container, .info-bar, .header, .game-info')) {
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
    
    // 2. Блокировка выделения на всех элементах игры
    document.addEventListener('selectstart', function(e) {
        const target = e.target;
        if (target.closest('.game, .game-container, .board-wrap, .board, canvas, .start-container, .difficulty-container, .stats-container, .rules-container, .index-flex-container, .info-bar, .header, .game-info')) {
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
    
    // 3. Блокировка прокрутки ТОЛЬКО на канвасе, не на кнопках
    document.addEventListener('touchmove', function(e) {
        const target = e.target;
        // Не блокируем кнопки
        if (target.closest('button, .icon-btn, .btn-control, .btn-scroll, .color-btn')) {
            return;
        }
        if (target.closest('.game, .game-container, .board-wrap, .board, canvas, .start-container, .difficulty-container, .stats-container, .rules-container')) {
            e.preventDefault();
        }
        if (target.tagName === 'CANVAS') {
            e.preventDefault();
        }
    }, { passive: false });
    
    // 4. Блокировка двойного касания для зума
    document.addEventListener('dblclick', function(e) {
        if (e.target.closest('.game, .game-container, .board-wrap, .board, canvas')) {
            e.preventDefault();
        }
        if (e.target.tagName === 'CANVAS') {
            e.preventDefault();
        }
    });
    
    // 5. Исправление высоты для мобильных
    function setVH() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', () => setTimeout(setVH, 300));
    setVH();
    
    // 6. Полноэкранный режим на мобильных
    function requestFullscreen() {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    }
    
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(requestFullscreen, 1000);
    });
    
    // 7. Предотвращение скролла на canvas
    document.addEventListener('wheel', function(e) {
        if (e.target.tagName === 'CANVAS') {
            e.preventDefault();
        }
        if (e.target.closest('.board-wrap')) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // 8. Фикс для iOS Safari
    document.addEventListener('touchstart', function(e) {
        const target = e.target;
        // Пропускаем кнопки
        if (target.closest('button, .icon-btn, .btn-control, .btn-scroll, .color-btn')) {
            return;
        }
        if (target.closest('.game, .game-container, .board-wrap, .board, canvas')) {
            e.preventDefault();
        }
        if (target.tagName === 'CANVAS') {
            e.preventDefault();
        }
    }, { passive: false });
    
    // 9. Блокировка перетаскивания
    document.addEventListener('dragstart', function(e) {
        if (e.target.closest('.game, .game-container, .board-wrap, .board, canvas')) {
            e.preventDefault();
        }
        if (e.target.tagName === 'CANVAS') {
            e.preventDefault();
        }
    });
    
    // 10. Блокировка копирования
    document.addEventListener('copy', function(e) {
        if (e.target.closest('.game, .game-container, .board-wrap, .board, canvas')) {
            e.preventDefault();
        }
        if (e.target.tagName === 'CANVAS') {
            e.preventDefault();
        }
    });
    
    // 11. ФИКС: Принудительная активация всех кнопок на мобильных
    document.addEventListener('DOMContentLoaded', function() {
        // Даём время на рендер
        setTimeout(function() {
            const allInteractive = document.querySelectorAll('button, .icon-btn, .btn-control, .btn-scroll, .color-btn');
            allInteractive.forEach(el => {
                el.style.pointerEvents = 'auto';
                el.style.touchAction = 'manipulation';
                el.style.position = 'relative';
                el.style.zIndex = '9999';
                el.style.cursor = 'pointer';
                // Убираем возможные блокировки
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
            });
            
            // Особенно хедер
            document.querySelectorAll('.header .icon-btn, .header button').forEach(el => {
                el.style.zIndex = '10000';
            });
            
            console.log('✅ Все кнопки принудительно активированы');
        }, 300);
    });
    
    console.log('✅ Исправления для модерации и мобильных кнопок применены');
})();