// ============================================================
// ГЛАВНОЕ МЕНЮ
// ============================================================

function initStartPage() {
    document.getElementById('rulesBtn').addEventListener('click', () => window.location.href = 'rules.html');
    document.getElementById('difficultyBtn').addEventListener('click', () => window.location.href = 'difficulty.html');
    document.getElementById('startBtn').addEventListener('click', () => window.location.href = 'game.html');
    document.getElementById('statsBtn').addEventListener('click', () => window.location.href = 'stats.html');
}

document.addEventListener('DOMContentLoaded', function() {
    initStartPage();
});