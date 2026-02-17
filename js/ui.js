export const elements = {
    inputArea: document.getElementById('input-text'),
    outputArea: document.getElementById('output-content'),
    actionSummary: document.getElementById('btn-summary'),
    actionFlashcards: document.getElementById('btn-flashcards'),
    actionTest: document.getElementById('btn-test'),
    actionChat: document.getElementById('btn-chat'),
    actionSettings: document.getElementById('btn-flashcards-settings'),
    historyList: document.getElementById('history-list'),
    loadingIndicator: document.getElementById('loading'),
    contentTitle: document.getElementById('content-title'),

    // Exams UI
    examsList: document.getElementById('exams-list'),
    btnCreateExam: document.getElementById('btn-create-exam'),
    createExamModal: document.getElementById('create-exam-modal'),
    closeCreateExam: document.getElementById('close-create-exam'),
    saveExamBtn: document.getElementById('save-exam'),
    cancelExamBtn: document.getElementById('cancel-exam'),
    examEmojiInput: document.getElementById('exam-emoji'),
    examTitleInput: document.getElementById('exam-title'),

    // Modal
    modal: document.getElementById('settings-modal'),
    closeModal: document.getElementById('close-modal'),
    saveSettings: document.getElementById('save-settings'),
    flashcardCountInput: document.getElementById('flashcard-count'),
    flashcardCountInfo: document.getElementById('flashcard-count-value')
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

export function renderTest(questions, onComplete) {
    elements.outputArea.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'test-container fade-in';

    const qWrapper = document.createElement('div');
    qWrapper.className = 'test-questions-wrapper';

    const side = document.createElement('div');
    side.className = 'test-side';

    // local copy so retry doesn't mutate original
    const qs = questions.map(q => ({ question: q.question, options: q.options.map(o => ({ text: o.text, correct: !!o.correct })) }));
    let index = 0;
    const answers = Array(qs.length).fill(null);

    const shuffle = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    };

    function renderQuestion(i) {
        qWrapper.innerHTML = '';
        const q = qs[i];

        const qCard = document.createElement('div');
        qCard.className = 'test-question card';
        qCard.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div class="test-step">Pregunta ${i + 1} de ${qs.length}</div>
                    <h3 style="margin-top:0.25rem;">${q.question}</h3>
                </div>
                <div style="min-width:80px; text-align:center; color:var(--text-muted);">Progreso<br><strong>${i + 1}/${qs.length}</strong></div>
            </div>
            <div class="test-options" style="margin-top:1rem; display:flex; flex-direction:column; gap:0.5rem;"></div>
        `;

        const optsContainer = qCard.querySelector('.test-options');
        q.options.forEach((opt, oi) => {
            const btn = document.createElement('button');
            btn.className = 'btn secondary';
            btn.textContent = opt.text;
            btn.style.textAlign = 'left';
            if (answers[i] && answers[i].selected === oi) {
                btn.style.backgroundColor = answers[i].correct ? '#16a34a' : '#ef4444';
                btn.style.color = 'white';
            }
            btn.addEventListener('click', () => {
                answers[i] = { selected: oi, correct: !!opt.correct };
                // mark selection
                Array.from(optsContainer.children).forEach((c, ci) => {
                    c.disabled = true;
                    c.style.opacity = '0.8';
                });
                btn.style.backgroundColor = opt.correct ? '#16a34a' : '#ef4444';
                btn.style.color = 'white';
                // enable next button
                nextBtn.disabled = false;
            });
            optsContainer.appendChild(btn);
        });

        qWrapper.appendChild(qCard);
        // disable next if unanswered
        nextBtn.disabled = !answers[i];
        prevBtn.disabled = i === 0;
    }

    // side panel content (progress circle + summary)
    const progressWrap = document.createElement('div');
    progressWrap.className = 'progress-circle';
    progressWrap.innerHTML = `
        <svg viewBox="0 0 140 140" role="img" aria-label="Resultado">
            <circle class="bg" cx="70" cy="70" r="70"></circle>
            <circle class="fg" cx="70" cy="70" r="70"></circle>
        </svg>
        <div class="progress-value">0%</div>
    `;

    const progressDesc = document.createElement('div');
    progressDesc.className = 'progress-desc';
    progressDesc.textContent = 'Resuelve las preguntas para ver tu resultado.';

    side.appendChild(progressWrap);
    side.appendChild(progressDesc);

    // navigation buttons
    const nav = document.createElement('div');
    nav.className = 'test-nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn secondary';
    prevBtn.textContent = 'Anterior';
    prevBtn.disabled = true;
    prevBtn.addEventListener('click', () => {
        if (index > 0) {
            index -= 1;
            renderQuestion(index);
        }
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn primary';
    nextBtn.textContent = 'Siguiente';
    nextBtn.disabled = true; // enabled when user answers
    nextBtn.addEventListener('click', async () => {
        if (index < qs.length - 1) {
            index += 1;
            renderQuestion(index);
        } else {
            // finalize
            const answered = answers.filter(Boolean);
            const correctCount = answered.reduce((acc, a) => acc + (a.correct ? 1 : 0), 0);
            const total = qs.length;
            const percent = Math.round((correctCount / total) * 100);

            // animate progress circle
            const fg = progressWrap.querySelector('circle.fg');
            const circumference = 2 * Math.PI * 70;
            const offset = circumference * (1 - percent / 100);
            fg.style.strokeDasharray = circumference;
            fg.style.strokeDashoffset = circumference; // start
            // force reflow then animate
            requestAnimationFrame(() => {
                fg.style.strokeDashoffset = offset;
            });

            progressWrap.querySelector('.progress-value').textContent = `${percent}%`;

            // descriptive sentence
            let msg = '';
            if (percent >= 85) msg = '¡Excelente! Has dominado este contenido.';
            else if (percent >= 60) msg = 'Bien — buen entendimiento, repasa lo restante.';
            else if (percent >= 35) msg = 'Necesitas practicar más en este tema.';
            else msg = 'Recomendado revisar desde el inicio y repetir ejercicios.';

            progressDesc.textContent = `${correctCount}/${total} correctas — ${msg}`;

            elements.contentTitle.textContent = `Test — Resultado: ${percent}%`;

            // callback to save session
            if (onComplete) onComplete({ score: percent, correctCount, total, questions: qs });

            // change nextBtn to allow finishing/closing
            nextBtn.textContent = 'Hecho';
            nextBtn.disabled = false;
            nextBtn.removeEventListener('click', () => {});
            nextBtn.addEventListener('click', () => {
                // do nothing or scroll to top
                elements.outputArea.scrollTop = 0;
            });
        }
    });

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn secondary';
    retryBtn.textContent = 'Reintentar';
    retryBtn.addEventListener('click', () => {
        // reshuffle questions & options, reset answers
        qs.forEach(q => shuffle(q.options));
        shuffle(qs);
        index = 0;
        for (let i = 0; i < answers.length; i++) answers[i] = null;
        progressWrap.querySelector('.progress-value').textContent = `0%`;
        const fg = progressWrap.querySelector('circle.fg');
        fg.style.strokeDashoffset = 2 * Math.PI * 70;
        progressDesc.textContent = 'Resuelve las preguntas para ver tu resultado.';
        elements.contentTitle.textContent = 'Test';
        renderQuestion(index);
    });

    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    nav.appendChild(retryBtn);

    // assemble
    qWrapper.appendChild(document.createElement('div')); // spacer
    container.appendChild(qWrapper);
    container.appendChild(side);
    container.appendChild(nav);

    elements.outputArea.appendChild(container);

    // initial shuffle and render
    qs.forEach(q => shuffle(q.options));
    shuffle(qs);
    renderQuestion(index);
    elements.contentTitle.textContent = `Test — ${qs.length} preguntas`;
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
    if (session.type === 'test') typeLabel = '🧪 Test';

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

export function renderExamItem(exam, onSelect) {
    const item = document.createElement('div');
    item.className = 'exam-item';
    item.dataset.id = exam.id;

    item.innerHTML = `
        <div style="font-size:1.1rem; width:28px; text-align:center;">${exam.emoji || '📘'}</div>
        <div class="exam-meta">
            <strong>${exam.title}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">Creado: ${new Date(exam.createdAt || Date.now()).toLocaleDateString()}</div>
        </div>
        <button class="delete-exam" data-id="${exam.id}" style="margin-left:auto; opacity:0;">×</button>
    `;

    item.addEventListener('click', () => onSelect(exam));
    item.querySelector('.delete-exam').addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const confirmed = confirm('Eliminar examen y su historial?');
        if (confirmed) onSelect({ ...exam, __delete: true });
    });

    item.addEventListener('mouseenter', () => item.querySelector('.delete-exam').style.opacity = '1');
    item.addEventListener('mouseleave', () => item.querySelector('.delete-exam').style.opacity = '0');

    return item;
}

export function updateExamsList(exams, onDeleteOrSelect, onSelect) {
    elements.examsList.innerHTML = '';
    exams.forEach(exam => {
        const el = renderExamItem(exam, (e) => {
            if (e.__delete) return onDeleteOrSelect('delete', exam.id);
            onSelect(exam);
        });
        elements.examsList.appendChild(el);
    });
}

export function markExamSelected(examId) {
    Array.from(elements.examsList.children).forEach(child => {
        if (child.dataset.id === String(examId)) child.classList.add('exam-selected');
        else child.classList.remove('exam-selected');
    });
}
