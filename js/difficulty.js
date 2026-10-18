// ============================================================
// ВЫБОР СЛОЖНОСТИ
// ============================================================

function initDifficultyPage() {
    let selected = localStorage.getItem('tripleColorDifficulty') || 'easy';
    
    const descriptions = {
        easy: '🟢 Лёгкая: Игрок может выставлять шашки любого цвета на любые позиции, видя расположение шашек противника.',
        medium: '🟡 Средняя: Игрок может выставлять случайно выбранные цвета шашек на любые позиции, не видя шашек противника.',
        hard: '🔴 Сложная: Игрок играет случайно выбранными шашками на случайных позициях.'
    };
    
    const btns = document.querySelectorAll('.difficulty-btn');
    btns.forEach(btn => {
        if (btn.dataset.diff === selected) btn.classList.add('active');
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selected = btn.dataset.diff;
            localStorage.setItem('tripleColorDifficulty', selected);
            const descDiv = document.getElementById('difficultyDescription');
            descDiv.innerHTML = `<p>${descriptions[selected]}</p>`;
        });
    });
    
    const descDiv = document.getElementById('difficultyDescription');
    descDiv.innerHTML = `<p>${descriptions[selected]}</p>`;
    
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'start.html';
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initDifficultyPage();
});