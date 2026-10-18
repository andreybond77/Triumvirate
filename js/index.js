// ============================================================
// ФАСАДНАЯ СТРАНИЦА
// ============================================================

function initFacadePage() {
    const menuBtn = document.getElementById('facadeMenuBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            window.location.href = 'start.html';
        });
    }
    
    window.addEventListener('load', () => {
        const progressBar = document.getElementById('loadingProgressBar');
        if (progressBar) {
            setTimeout(() => {
                progressBar.style.width = '100%';
            }, 100);
        }
        
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
                setTimeout(() => {
                    loadingScreen.remove();
                }, 500);
            }
        }, 1500);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initFacadePage();
});