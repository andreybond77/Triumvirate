// ============================================================
// СТРАНИЦА ПРАВИЛ
// ============================================================

function initRulesPage() {
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'start.html';
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initRulesPage();
});