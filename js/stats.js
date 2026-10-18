
// ============================================================
// СТАТИСТИКА
// ============================================================

function initStatsPage() {
    renderStats();
    
    document.getElementById('resetStatsBtn').addEventListener('click', function() {
        // Просто сбрасываем статистику без подтверждений и уведомлений
        localStorage.removeItem('tripleColorStats');
        renderStats();
    });
    
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'start.html';
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initStatsPage();
});