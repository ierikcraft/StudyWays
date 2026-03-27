export const elements = {
    inputArea: document.getElementById('input-text'),
    outputArea: document.getElementById('output-content'),
    actionSummary: document.getElementById('btn-summary'),
    actionAudioSummary: document.getElementById('btn-audio-summary'),
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
    flashcardCountInfo: document.getElementById('flashcard-count-value'),

    // Test count modal
    testCountModal: document.getElementById('test-count-modal'),
    testCountInput: document.getElementById('test-count-input'),
    testCountStartBtn: document.getElementById('start-test'),
    testCountCloseBtn: document.getElementById('close-test-count'),
    testCountCancelBtn: document.getElementById('cancel-test')
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

export function renderAudioSummary(summaryText) {
    elements.outputArea.innerHTML = `
        <div class="audio-summary-content fade-in">
            <div class="audio-controls">
                <button id="btn-play-audio" class="btn primary" style="gap: 0.5rem; display: flex; align-items: center; justify-content: center;">
                    🔊 Reproducir Audio
                </button>
                <button id="btn-pause-audio" class="btn secondary" style="gap: 0.5rem; display: flex; align-items: center; justify-content: center; display: none;">
                    ⏸️ Pausar
                </button>
                <button id="btn-stop-audio" class="btn secondary" style="gap: 0.5rem; display: flex; align-items: center; justify-content: center;">
                    ⏹️ Detener
                </button>
            </div>
            <div class="audio-text-display" style="margin-top: 1.5rem; padding: 1rem; background-color: var(--background-color); border-radius: var(--radius-md); font-size: 1rem; line-height: 1.6;">
                ${escapeHtml(summaryText)}
            </div>
        </div>
    `;
    elements.contentTitle.textContent = '🔊 Resumen de Audio';
    
    setupAudioControls(summaryText);
}

function setupAudioControls(summaryText) {
    const playBtn = document.getElementById('btn-play-audio');
    const pauseBtn = document.getElementById('btn-pause-audio');
    const stopBtn = document.getElementById('btn-stop-audio');
    
    let isSpeaking = false;
    
    playBtn.addEventListener('click', () => {
        if ('speechSynthesis' in window) {
            if (isSpeaking) {
                window.speechSynthesis.resume();
                playBtn.style.display = 'none';
                pauseBtn.style.display = 'flex';
            } else {
                const utterance = new SpeechSynthesisUtterance(summaryText);
                utterance.lang = 'es-ES';
                utterance.rate = 0.9;
                utterance.pitch = 1;
                
                utterance.onend = () => {
                    isSpeaking = false;
                    playBtn.style.display = 'flex';
                    pauseBtn.style.display = 'none';
                };
                
                window.speechSynthesis.speak(utterance);
                isSpeaking = true;
                playBtn.style.display = 'none';
                pauseBtn.style.display = 'flex';
            }
        } else {
            alert('Tu navegador no soporta síntesis de voz.');
        }
    });
    
    pauseBtn.addEventListener('click', () => {
        if (isSpeaking) {
            window.speechSynthesis.pause();
            pauseBtn.style.display = 'none';
            playBtn.style.display = 'flex';
        }
    });
    
    stopBtn.addEventListener('click', () => {
        window.speechSynthesis.cancel();
        isSpeaking = false;
        playBtn.style.display = 'flex';
        pauseBtn.style.display = 'none';
    });
}

export function renderFlashcards(cards, onExplain) {
    elements.outputArea.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'flashcards-carousel fade-in';
    
    let currentIndex = 0;
    
    const carouselHTML = `
        <div class="flashcards-carousel-wrapper">
            <div class="flashcards-nav-top">
                <button id="flashcard-prev" class="flashcard-nav-btn" title="Anterior">
                    ←
                </button>
                <div class="flashcards-progress">
                    <span id="flashcard-current">1</span> / <span id="flashcard-total">${cards.length}</span> tarjetas
                </div>
                <button id="flashcard-next" class="flashcard-nav-btn" title="Siguiente">
                    →
                </button>
            </div>
            
            <div id="flashcard-display" class="flashcard-display">
                <div class="flashcard-inner">
                    <div class="flashcard-front">
                        <p>${escapeHtml(cards[0].question)}</p>
                    </div>
                    <div class="flashcard-back">
                        <p>${escapeHtml(cards[0].answer)}</p>
                    </div>
                </div>
            </div>
            
            <div class="flashcard-actions">
                <button id="flashcard-explain" class="btn secondary" style="gap: 0.5rem;">
                    📖 Explica
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = carouselHTML;
    elements.outputArea.appendChild(container);
    
    const displayCard = document.getElementById('flashcard-display');
    const currentSpan = document.getElementById('flashcard-current');
    const prevBtn = document.getElementById('flashcard-prev');
    const nextBtn = document.getElementById('flashcard-next');
    const explainBtn = document.getElementById('flashcard-explain');
    
    function updateCard() {
        const card = cards[currentIndex];
        displayCard.innerHTML = `
            <div class="flashcard-inner">
                <div class="flashcard-front">
                    <p>${escapeHtml(card.question)}</p>
                </div>
                <div class="flashcard-back">
                    <p>${escapeHtml(card.answer)}</p>
                </div>
            </div>
        `;
        currentSpan.textContent = currentIndex + 1;
        displayCard.classList.remove('flipped');
        
        // Re-attach click listener for flip
        displayCard.addEventListener('click', () => {
            displayCard.classList.toggle('flipped');
        });
    }
    
    displayCard.addEventListener('click', () => {
        displayCard.classList.toggle('flipped');
    });
    
    prevBtn.addEventListener('click', () => {
        currentIndex = (currentIndex - 1 + cards.length) % cards.length;
        updateCard();
    });
    
    nextBtn.addEventListener('click', () => {
        currentIndex = (currentIndex + 1) % cards.length;
        updateCard();
    });
    
    explainBtn.addEventListener('click', () => {
        if (onExplain) {
            const card = cards[currentIndex];
            onExplain(card);
        }
    });
    
    elements.contentTitle.textContent = '🗂️ Flashcards';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

export function renderTest(questions, onComplete, opts = {}) {
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
    // If caller provided previously selected answers (review mode), seed them here
    if (opts.userAnswers && Array.isArray(opts.userAnswers)) {
        opts.userAnswers.forEach((sel, i) => {
            if (sel === null || typeof sel === 'undefined') return;
            const correct = !!qs[i].options[sel] && !!qs[i].options[sel].correct;
            answers[i] = { selected: sel, correct };
        });
    }

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
            if (opts.readOnly) {
                // disable interaction in review mode, but highlight correct option border
                btn.disabled = true;
                if (opt.correct) btn.style.borderColor = '#16a34a';
            } else {
                btn.addEventListener('click', () => {
                    answers[i] = { selected: oi, correct: !!opt.correct };
                    // mark selection
                    Array.from(optsContainer.children).forEach((c, ci) => {
                        c.disabled = true;
                        c.style.opacity = '0.8';
                    });
                    btn.style.backgroundColor = opt.correct ? '#16a34a' : '#ef4444';
                    btn.style.color = 'white';
                    // reflect in side index
                    const idxBtn = qIndexesEl.children[i];
                    if (idxBtn) {
                        idxBtn.classList.add('answered');
                        idxBtn.classList.add(opt.correct ? 'correct' : 'incorrect');
                        idxBtn.classList.remove('current');
                    }
                    // enable next button
                    nextBtn.disabled = false;
                });
            }
            optsContainer.appendChild(btn);
        });

        // focus first option for better keyboard UX
        const firstOption = optsContainer.querySelector('button:not(:disabled)');
        if (firstOption) firstOption.focus();

        qWrapper.appendChild(qCard);
        // update status indexes (answered/current)
        Array.from(qIndexesEl.children).forEach((btn, bi) => {
            btn.classList.toggle('current', bi === i);
            btn.classList.remove('answered', 'correct', 'incorrect');
            if (answers[bi]) {
                btn.classList.add('answered');
                btn.classList.add(answers[bi].correct ? 'correct' : 'incorrect');
            }
        });
        // disable next if unanswered (but allow navigation in review/readOnly)
        nextBtn.disabled = !!opts.readOnly ? false : !answers[i];
        prevBtn.disabled = i === 0;
    }

    // side panel: simple progress + per-question indicators (no circle)
    const statusWrap = document.createElement('div');
    statusWrap.className = 'test-status';
    statusWrap.innerHTML = `
        <div class="progress-value">0%</div>
        <div class="q-indexes" aria-hidden="true"></div>
        <div class="progress-desc">Resuelve las preguntas para ver tu resultado.</div>
    `;

    const progressValueEl = statusWrap.querySelector('.progress-value');
    const qIndexesEl = statusWrap.querySelector('.q-indexes');
    const progressDescEl = statusWrap.querySelector('.progress-desc');

    // build index buttons
    qs.forEach((_, i) => {
        const idxBtn = document.createElement('button');
        idxBtn.className = 'q-index-btn';
        idxBtn.title = `Ir a la pregunta ${i + 1}`;
        idxBtn.textContent = String(i + 1);
        idxBtn.addEventListener('click', () => {
            index = i;
            renderQuestion(index);
        });
        qIndexesEl.appendChild(idxBtn);
    });

    side.appendChild(statusWrap);

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

            // update simple progress UI
            progressValueEl.textContent = `${percent}%`;

            const successPhrases = [
                '¡Muy bien campeón!',
                '¡Excelente trabajo!',
                '¡Lo hiciste genial!',
                '¡Sigue así, vas por buen camino!',
                '¡Qué gran resultado!',
                '¡Eres un genio!',
                '¡Impresionante!',
                '¡Dominas este tema!',
                '¡Fantástico esfuerzo!',
                '¡Una diva es valiente i poderosa!',
                '¡Bravo, sigue brillando!',
                '¡Ni Einstein en sus mejores días!',
                '¡Aprobado con honores y estilo!',
                '¡Cuidado, que tu cerebro está echando humo (del bueno)!',
                '¡Más crack que un hueso roto!',
                '¡Sobresaliente! El próximo premio Nobel es tuyo.',
                '¡Modo Dios: ACTIVADO!',
                '¡Tu inteligencia asusta un poco la verdad!',
                '¡Eso es! Hasta Google te pediría consejos.',
                '¡Felicidades! Tienes más luces que un árbol de Navidad.',
                '¡Te saliste! Eres el/la MVP de este test.'
            ];

            const failPhrases = [
                'Tú puedes, ¡a la próxima!',
                '¡No te rindas, sigue practicando!',
                'De los errores se aprende, ¡ánimo!',
                'Estás cerca, ¡inténtalo de nuevo!',
                '¡Cada intento te hace más sabio!',
                'No pasa nada, ¡a repasarlo!',
                '¡Toma aire y vuelve a intentarlo!',
                'Un pequeño tropiezo, ¡tú puedes con esto!',
                'Poco a poco, ¡lo vas a lograr!',
                'No he visto a nadie mas malo que tu pero, ¡lo vas a lograr!',
                'El éxito requiere tiempo, ¡sigue adelante!',
                'Bueno, al menos seguro que eres guapo/a...',
                '¡Ups! Parece que tu cerebro estaba en modo avión.',
                'Tranquilo/a, hasta a Messi se le escapan los penaltis.',
                'Hemos tocado fondo, ¡ahora solo queda subir!',
                '¡Error 404: Respuesta correcta no encontrada!',
                'Creo que necesitas un café... o tres.',
                '¡Casi! Solo te faltó la parte de acertar.',
                'La intención es lo que cuenta (aunque aquí no sume puntos).',
                '¡Ánimo! Roma no se construyó en un día, tampoco tus dieces.',
                'Si lloras, asegúrate de no mojar el teclado.'
            ];

            // descriptive sentence
            let msg = '';
            const randomMsg = (arr) => arr[Math.floor(Math.random() * arr.length)];

            if (percent >= 50) {
                msg = randomMsg(successPhrases);
            } else {
                msg = randomMsg(failPhrases);
            }

            progressDescEl.textContent = `${correctCount}/${total} correctas — ${msg}`;
            elements.contentTitle.textContent = `Test — Resultado: ${percent}%`;

            // mark status buttons
            Array.from(qIndexesEl.children).forEach((btn, bi) => {
                btn.classList.remove('current');
                if (answers[bi]) {
                    btn.classList.add('answered');
                    btn.classList.add(answers[bi].correct ? 'correct' : 'incorrect');
                }
            });

            // callback to save session (include user's answers)
            const userAnswers = answers.map(a => a ? a.selected : null);
            if (onComplete) onComplete({ score: percent, correctCount, total, questions: qs, userAnswers });

            // change nextBtn to allow finishing/closing
            nextBtn.textContent = 'Hecho';
            nextBtn.disabled = false;
            nextBtn.removeEventListener('click', () => {});
            nextBtn.addEventListener('click', () => {
                elements.outputArea.scrollTop = 0;
            });

            if (opts.onExpertAdvice && !nav.querySelector('.expert-btn')) {
                const expertBtn = document.createElement('button');
                expertBtn.className = 'btn primary expert-btn';
                expertBtn.style.backgroundColor = '#8b5cf6';
                expertBtn.style.borderColor = '#8b5cf6';
                expertBtn.innerHTML = '💡 Consejo del Experto';
                expertBtn.addEventListener('click', () => {
                   opts.onExpertAdvice(qs, answers, qWrapper, expertBtn); 
                });
                nav.insertBefore(expertBtn, nextBtn);
            }
        }
    });

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn secondary';
    retryBtn.textContent = opts.readOnly ? 'Volver a hacer' : 'Reintentar';
    retryBtn.addEventListener('click', () => {
        // If reviewing a past session, start an interactive run with same questions
        if (opts.readOnly) {
            renderTest(questions, onComplete, {});
            return;
        }
        // reshuffle questions & options, reset answers
        qs.forEach(q => shuffle(q.options));
        shuffle(qs);
        index = 0;
        for (let i = 0; i < answers.length; i++) answers[i] = null;
        progressValueEl.textContent = `0%`;
        progressDescEl.textContent = 'Resuelve las preguntas para ver tu resultado.';
        Array.from(qIndexesEl.children).forEach(btn => {
            btn.classList.remove('answered', 'correct', 'incorrect', 'current');
        });
        elements.contentTitle.textContent = 'Test';

        const existingExpert = nav.querySelector('.expert-btn');
        if (existingExpert) existingExpert.remove();
        const existingAdvice = qWrapper.querySelector('.advice-content');
        if (existingAdvice) existingAdvice.remove();

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

    // initial shuffle and render — do NOT shuffle when reviewing a saved session
    if (!opts.readOnly) {
        qs.forEach(q => shuffle(q.options));
        shuffle(qs);
    }
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
    if (session.type === 'audio-summary') typeLabel = '🔊 Audio';
    if (session.type === 'flashcard') typeLabel = '🗂️ Flashcards';
    if (session.type === 'chat') typeLabel = '💬 Chat';
    if (session.type === 'test') typeLabel = '🧪 Test';

    const previewText = session.type === 'flashcard'
        ? `${(session.content || []).length || 0} tarjetas`
        : session.type === 'test'
            ? `${session.content && session.content.score ? session.content.score + '% — ' + (session.content.correctCount || 0) + '/' + (session.content.total || session.content.questions?.length || '?') : (session.meta && session.meta.count ? session.meta.count + ' preguntas' : session.originalText.substring(0, 30) + '...')}`
            : session.type === 'audio-summary'
                ? (session.content ? session.content.substring(0, 50) + '...' : '')
                : session.originalText ? session.originalText.substring(0, 30) + '...' : '';

    item.innerHTML = `
        <div class="history-info">
            <span class="history-type">${typeLabel}</span>
            <span class="history-date">${date}</span>
            <span class="history-preview">${previewText}</span>
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
