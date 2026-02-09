export const elements = {
    inputArea: document.getElementById('input-text'),
    outputArea: document.getElementById('output-content'),
    actionSummary: document.getElementById('btn-summary'),
    actionFlashcards: document.getElementById('btn-flashcards'),
    historyList: document.getElementById('history-list'),
    loadingIndicator: document.getElementById('loading'),
    contentTitle: document.getElementById('content-title')
};

export function toggleLoading(isLoading) {
    if (isLoading) {
        elements.loadingIndicator.classList.remove('hidden');
        elements.outputArea.classList.add('hidden');
    } else {
        elements.loadingIndicator.classList.add('hidden');
        elements.outputArea.classList.remove('hidden');
    }
}

export function renderSummary(summary) {
    elements.outputArea.innerHTML = `
        <div class="summary-content fade-in">
            <div class="markdown-body">${marked.parse(summary)}</div>
        </div>
    `;
    elements.contentTitle.textContent = 'Resumen';
}

export function renderFlashcards(cards) {
    elements.outputArea.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'flashcards-grid fade-in';

    cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'flashcard';
        cardEl.innerHTML = `
            <div class="flashcard-inner">
                <div class="flashcard-front">
                    <p>${card.question}</p>
                </div>
                <div class="flashcard-back">
                    <p>${card.answer}</p>
                </div>
            </div>
        `;
        cardEl.addEventListener('click', () => {
            cardEl.classList.toggle('flipped');
        });
        container.appendChild(cardEl);
    });

    elements.outputArea.appendChild(container);
    elements.contentTitle.textContent = 'Flashcards';
}

export function renderHistoryItem(session, onClick) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const date = new Date(session.date).toLocaleDateString();
    const typeLabel = session.type === 'summary' ? '📝 Resumen' : '🗂️ Flashcards';

    item.innerHTML = `
        <div class="history-info">
            <span class="history-type">${typeLabel}</span>
            <span class="history-date">${date}</span>
            <span class="history-preview">${session.originalText.substring(0, 30)}...</span>
        </div>
        <button class="delete-btn" data-id="${session.id}">×</button>
    `;

    item.querySelector('.history-info').addEventListener('click', () => onClick(session));
    return item;
}

export function updateHistoryList(sessions, onDelete, onLoad) {
    elements.historyList.innerHTML = '';
    sessions.forEach(session => {
        const el = renderHistoryItem(session, onLoad);
        el.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            onDelete(session.id);
        });
        elements.historyList.appendChild(el);
    });
}
