export const elements = {
    inputArea: document.getElementById('input-text'),
    outputArea: document.getElementById('output-content'),
    actionSummary: document.getElementById('btn-summary'),
    actionFlashcards: document.getElementById('btn-flashcards'),
    actionChat: document.getElementById('btn-chat'),
    actionSettings: document.getElementById('btn-flashcards-settings'),
    historyList: document.getElementById('history-list'),
    loadingIndicator: document.getElementById('loading'),
    contentTitle: document.getElementById('content-title'),
    // Modal
    modal: document.getElementById('settings-modal'),
    closeModal: document.getElementById('close-modal'),
    saveSettings: document.getElementById('save-settings'),
    flashcardCountInput: document.getElementById('flashcard-count'),
    flashcardCountInfo: document.getElementById('flashcard-count-value'),

    // Notebooks
    notebookList: document.getElementById('notebook-list'),
    btnNewNotebook: document.getElementById('btn-new-notebook')
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
    elements.contentTitle.textContent = 'Results: Resumen';
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
    elements.contentTitle.textContent = 'Results: Flashcards';
}

export function renderChatInterface(onSend) {
    elements.outputArea.innerHTML = `
        <div class="chat-container fade-in">
            <div id="chat-messages" class="chat-messages">
                <div class="chat-bubble ai">Hola, soy tu asistente de estudio. Hazme cualquier pregunta sobre el texto.</div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="chat-input" placeholder="Escribe tu pregunta..." style="flex:1; border:1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.5rem;">
                <button id="send-chat" class="btn primary" style="width: auto;">Enviar</button>
            </div>
        </div>
    `;
    elements.contentTitle.textContent = 'Chat Q&A';

    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat');

    const handleSend = () => {
        const text = input.value.trim();
        if (text) {
            onSend(text);
            input.value = '';
        }
    };

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSend();
    });
}

export function appendChatMessage(role, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role} fade-in`;
    bubble.textContent = text;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

export function renderHistoryItem(session, onClick) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const date = new Date(session.date).toLocaleDateString();
    let typeLabel = '📄 Archivo';
    if (session.type === 'summary') typeLabel = '📝 Resumen';
    if (session.type === 'flashcard') typeLabel = '🗂️ Flashcards';
    if (session.type === 'chat') typeLabel = '💬 Chat';

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
    if (!sessions || sessions.length === 0) {
        elements.historyList.innerHTML = '<div style="padding:0.5rem; color:var(--text-muted); font-size:0.9rem;">Vacío</div>';
        return;
    }

    sessions.forEach(session => {
        const el = renderHistoryItem(session, onLoad);
        el.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            onDelete(session.id);
        });
        elements.historyList.appendChild(el);
    });
}

export function renderNotebookList(notebooks, activeId, onSelect, onDelete) {
    elements.notebookList.innerHTML = '';
    notebooks.forEach(notebook => {
        const item = document.createElement('div');
        item.className = `sidebar-item ${notebook.id === activeId ? 'active' : ''}`;
        item.innerHTML = `
            <span class="item-title">📔 ${notebook.title}</span>
            <button class="delete-btn">×</button>
        `;

        item.addEventListener('click', () => onSelect(notebook.id));
        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`¿Borrar cuaderno "${notebook.title}"?`)) {
                onDelete(notebook.id);
            }
        });

        elements.notebookList.appendChild(item);
    });
}

export function promptNewNotebook() {
    return prompt('Nombre del nuevo cuaderno:', 'Nuevo Cuaderno');
}
