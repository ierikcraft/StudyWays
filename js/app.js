import * as api from './api.js?v=4';
import * as storage from './storage.js?v=4';
import * as ui from './ui.js?v=4';
import * as auth from './auth.js?v=4';
import * as pdfUtils from './pdf_utils.js?v=4';

let flashcardCount = 5;
let chatHistory = [];
let currentContext = '';
let currentUser = null;
let currentExam = null;
let loadedPDFs = []; // Array to store loaded PDFs

document.addEventListener('DOMContentLoaded', () => {
    // ErikAI Welcome popup
    const urlParams = new URLSearchParams(window.location.search);
    const erikaiParam = urlParams.get('erikai');
    if (erikaiParam && erikaiParam.toLowerCase() === 'true' && !localStorage.getItem('erikai_welcome_shown')) {
        setTimeout(() => {
            showCustomAlert("ErikAI ha mejorado la forma de estudiar:\n\n✅ Crea resúmenes de audio\n✅ Crea flash cards\ny mucho más...", "✨");
            localStorage.setItem('erikai_welcome_shown', 'true');
        }, 500);
    }

    // Check Auth
    let user = auth.getUser();
    if (!user) {
        user = auth.handleAuthCallback();
    }

    if (user) {
        currentUser = user;
        showApp(user);
    } else {
        showLanding();
    }

    // Auth Actions
    document.getElementById('btn-login').addEventListener('click', auth.login);
    document.getElementById('btn-logout').addEventListener('click', auth.logout);
    const dashLogout = document.getElementById('dash-btn-logout');
    if (dashLogout) dashLogout.addEventListener('click', auth.logout);

    // Main Actions
    ui.elements.actionSummary.addEventListener('click', handleSummary);
    ui.elements.actionAudioSummary.addEventListener('click', handleAudioSummary);
    ui.elements.actionFlashcards.addEventListener('click', handleFlashcards);
    ui.elements.actionTest.addEventListener('click', handleTest);
    ui.elements.actionChat.addEventListener('click', initializeChat);
    document.getElementById('input-text').addEventListener('input', updateCharCount);

    // PDF Upload
    const btnUpload = document.getElementById('btn-upload-pdf');
    const fileInput = document.getElementById('pdf-upload');

    btnUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            ui.toggleLoading(true);
            try {
                for (let file of files) {
                    const base64 = await pdfUtils.fileToBase64(file);
                    const text = await pdfUtils.extractTextFromPDF(file);
                    
                    let fakeId = Date.now() + Math.random();
                    if (currentExam && !currentExam.isLocal) {
                        try {
                            const result = await storage.savePdfToExam(currentUser.id, currentExam.id, file.name, base64);
                            if (result) {
                                fakeId = result.id;
                            }
                        } catch (err) {
                            console.error("Cloud save failed for PDF", err);
                        }
                    }
                    addPDFToList(file.name, text, fakeId);
                }
            } catch (error) {
                alert('Error al leer el PDF: ' + error.message);
                console.error(error);
            } finally {
                ui.toggleLoading(false);
                // Reset input
                fileInput.value = '';
            }
        }
    });

    // Settings Modal
    ui.elements.actionSettings.addEventListener('click', openSettings);
    ui.elements.closeModal.addEventListener('click', closeSettings);
    ui.elements.saveSettings.addEventListener('click', saveSettings);
    ui.elements.flashcardCountInput.addEventListener('input', (e) => {
        ui.elements.flashcardCountInfo.textContent = e.target.value;
    });

    // Test-count modal handlers
    if (ui.elements.testCountStartBtn) {
        ui.elements.testCountStartBtn.addEventListener('click', async () => {
            const raw = ui.elements.testCountInput.value;
            const count = parseInt(raw, 10);
            if (!Number.isInteger(count) || count < 1) {
                return showCustomAlert('Introduce un número válido de al menos 1 pregunta.');
            }
            if (count > 50) {
                return showCustomAlert('Por motivos de seguridad, el límite máximo es de 50 preguntas por test.');
            }
            ui.elements.testCountModal.classList.add('hidden');

            // proceed with generating the test (same logic as previous inline flow)
            const text = ui.elements.inputArea.value.trim();
            if (!text) return showCustomAlert('Por favor ingresa un texto para generar el test.');
            if (!currentExam) return showCustomAlert('Selecciona o crea un examen antes de guardar.');

            ui.toggleLoading(true);
            try {
                const questions = await api.generateTest(text, count);
                // Shuffle questions and shuffle options inside each question
                shuffleArray(questions);
                questions.forEach(q => shuffleArray(q.options));

                ui.elements.contentTitle.textContent = `Test — ${count} preguntas`;

                ui.renderTest(questions, async (result) => {
                    // Save test session (include user's answers + meta.count)
                    await storage.saveSession(currentUser.id, currentExam.id, {
                        type: 'test',
                        content: { questions: result.questions, userAnswers: result.userAnswers || [], score: result.score, correctCount: result.correctCount },
                        originalText: text,
                        meta: { count }
                    });
                    await loadHistory();
                }, {
                    onExpertAdvice: (qs, answers, container, btn) => handleExpertAdvice(text, qs, answers, container, btn)
                });
            } catch (err) {
                console.error(err);
                alert('Error generando test: ' + err.message);
            } finally {
                ui.toggleLoading(false);
            }
        });
        ui.elements.testCountCancelBtn.addEventListener('click', () => ui.elements.testCountModal.classList.add('hidden'));
        ui.elements.testCountCloseBtn.addEventListener('click', () => ui.elements.testCountModal.classList.add('hidden'));
    }

    // Exams: create/select
    ui.elements.btnCreateExam.addEventListener('click', openCreateExamModal);
    ui.elements.closeCreateExam.addEventListener('click', closeCreateExamModal);
    ui.elements.cancelExamBtn.addEventListener('click', closeCreateExamModal);
    ui.elements.saveExamBtn.addEventListener('click', saveNewExam);

    // Notebook dashboard: create button (if present on the landing dashboard)
    const btnCreateNotebook = document.getElementById('btn-create-notebook');
    if (btnCreateNotebook) btnCreateNotebook.addEventListener('click', openCreateExamModal);

    // Back to dashboard from app
    const btnBack = document.getElementById('btn-back-dashboard');
    if (btnBack) btnBack.addEventListener('click', showNotebookDashboard);

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === ui.elements.modal) closeSettings();
        if (e.target === ui.elements.createExamModal) closeCreateExamModal();
        if (e.target === ui.elements.testCountModal) ui.elements.testCountModal.classList.add('hidden');
    });

    // showApp already handles showing the notebook dashboard if the user is logged in.
});

async function loadExams() {
    try {
        const exams = await storage.listExams(currentUser.id);
        if (!exams || exams.length === 0) {
            // create default exam
            const d = await storage.createExam(currentUser.id, { emoji: '📚', title: 'General' });
            currentExam = d;
            await loadHistory();
            await refreshExamsList();
            return;
        }
        await refreshExamsList();
        // select first exam if none selected
        if (!currentExam) selectExam(exams[0]);
    } catch (err) {
        console.error('Error loading exams', err);
        alert('No se pudieron cargar los exámenes.');
    }
}

async function refreshExamsList() {
    const exams = await storage.listExams(currentUser.id);
    ui.updateExamsList(exams,
        async (action, examId) => {
            if (action === 'delete') {
                await storage.deleteExam(currentUser.id, examId);
                if (currentExam && currentExam.id === examId) currentExam = null;
                await refreshExamsList();
                if (!currentExam) {
                    const remaining = await storage.listExams(currentUser.id);
                    if (remaining.length) selectExam(remaining[0]);
                }
                await loadHistory();
            }
        },
        (exam) => selectExam(exam)
    );
    ui.markExamSelected(currentExam ? currentExam.id : null);
}

async function selectExam(exam) {
    currentExam = exam;
    ui.markExamSelected(exam.id);
    loadHistory();
    
    loadedPDFs = [];
    ui.elements.inputArea.value = '';
    updatePDFListUI();
    ui.elements.inputArea.dispatchEvent(new Event('input'));
    
    if (exam && !exam.isLocal) {
        ui.toggleLoading(true);
        try {
            const pdfs = await storage.loadPdfsForExam(currentUser.id, exam.id);
            for (let p of pdfs) {
                const blob = pdfUtils.base64ToBlob(p.value, 'application/pdf');
                const file = new File([blob], p.name, { type: 'application/pdf' });
                const text = await pdfUtils.extractTextFromPDF(file);
                addPDFToList(p.name, text, p.id);
            }
        } catch (err) {
            console.error("Error loading PDFs for exam", err);
        } finally {
            ui.toggleLoading(false);
        }
    }
}

function openCreateExamModal() {
    ui.elements.createExamModal.classList.remove('hidden');
    ui.elements.examEmojiInput.value = '';
    ui.elements.examTitleInput.value = '';
    ui.elements.examEmojiInput.focus();
}

function closeCreateExamModal() {
    ui.elements.createExamModal.classList.add('hidden');
}

async function saveNewExam() {
    if (!currentUser) return alert('Debes iniciar sesión para crear un examen.');
    const emoji = ui.elements.examEmojiInput.value.trim() || '📘';
    const title = ui.elements.examTitleInput.value.trim() || 'Nuevo examen';
    const exam = await storage.createExam(currentUser.id, { emoji, title });
    closeCreateExamModal();
    await refreshExamsList();
    selectExam(exam);
    // Open the study panel after creating/selecting
    showAppContainer();
}

function showApp(user) {
    // After login, show the notebook dashboard (prototype) instead of opening app directly
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('notebook-dashboard').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');

    document.getElementById('user-name').textContent = user.name;
    document.getElementById('dash-user-name').textContent = user.name;
    // Optional: Set avatar if available or initials
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

    // render dashboard
    renderNotebooksDashboard();

    // delete-all button handler (local-only storage)
    const delAllBtn = document.getElementById('btn-delete-all');
    if (delAllBtn) {
        delAllBtn.addEventListener('click', async () => {
            if (!currentUser) return alert('Debes iniciar sesión');
            const ok = confirm('Eliminar todas las libretas y su historial (local)?');
            if (!ok) return;
            await storage.deleteAllExams(currentUser.id);
            await refreshExamsList();
            renderNotebooksDashboard();
            alert('Todas las libretas han sido eliminadas (local).');
        });
    }
}

function showLanding() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('notebook-dashboard').classList.add('hidden');
}

function showNotebookDashboard() {
    // show dashboard (used from Back button)
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('notebook-dashboard').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    if (currentUser) document.getElementById('dash-user-name').textContent = currentUser.name;
    renderNotebooksDashboard();
}

function showAppContainer() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('notebook-dashboard').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
}

async function renderNotebooksDashboard() {
    if (!currentUser) return;

    try {
        const exams = await storage.listExams(currentUser.id);
        const grid = document.getElementById('notebooks-grid');
        grid.querySelectorAll('.notebook-card.item').forEach(n => n.remove());
        exams.forEach(exam => {
            const card = document.createElement('div');
            card.className = 'notebook-card item';
            card.dataset.id = exam.id;
            card.innerHTML = `
                <div style="font-size:1.2rem; margin-right:0.5rem;">${exam.emoji || '📘'}</div>
                <div style="display:flex; flex-direction:column;">
                    <strong>${exam.title}</strong>
                    <small style="color:var(--text-muted);">Creado: ${new Date(exam.createdAt || Date.now()).toLocaleDateString()}</small>
                </div>
            `;
            card.addEventListener('click', async () => {
                // switch to app and select exam
                selectExam(exam);
                await refreshExamsList();
                showAppContainer();
            });
            // insert before the "new" card
            const newCard = document.getElementById('btn-create-notebook');
            grid.insertBefore(card, newCard);
        });
    } catch (err) {
        console.error('Error rendering notebooks dashboard', err);
    }
}


function updateCharCount(e) {
    const count = e.target.value.length;
    document.getElementById('char-count').textContent = `${count} caracteres`;
}

// --- Test Logic ---
async function handleTest() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return showCustomAlert('Por favor ingresa un texto para generar el test.');
    if (text.length > 25000) return showCustomAlert('El texto es demasiado largo (~25000 caracteres máx). Por favor, redúcelo.');
    if (!currentExam) return showCustomAlert('Selecciona o crea un examen antes de guardar.');

    // show modal to pick number of questions (replaces prompt())
    const defaultCount = Number(ui.elements.flashcardCountInput.value) || 5;
    ui.elements.testCountInput.value = String(defaultCount);
    ui.elements.testCountModal.classList.remove('hidden');
    ui.elements.testCountInput.focus();
}


function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}


// --- Settings Logic ---
function openSettings() {
    ui.elements.modal.classList.remove('hidden');
}

function closeSettings() {
    ui.elements.modal.classList.add('hidden');
}

function saveSettings() {
    flashcardCount = ui.elements.flashcardCountInput.value;
    closeSettings();
    // Optional: show a toast or feedback
}

// --- Feature Logic ---

async function handleSummary() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto.');
    if (text.length > 25000) return alert('El texto es demasiado largo (~25000 caracteres máx). Por favor, redúcelo.');
    if (!currentExam) return alert('Selecciona o crea un examen antes de guardar.');

    ui.toggleLoading(true);
    try {
        const summary = await api.generateSummary(text);
        ui.renderSummary(summary);

        await storage.saveSession(currentUser.id, currentExam.id, {
            type: 'summary',
            content: summary,
            originalText: text
        });
        await loadHistory();
    } catch (error) {
        alert('Error al generar resumen: ' + error.message);
    } finally {
        ui.toggleLoading(false);
    }
}

async function handleAudioSummary() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto.');
    if (text.length > 25000) return alert('El texto es demasiado largo (~25000 caracteres máx). Por favor, redúcelo.');
    if (!currentExam) return alert('Selecciona o crea un examen antes de guardar.');

    ui.toggleLoading(true);
    try {
        const audioSummary = await api.generateAudioSummary(text);
        ui.renderAudioSummary(audioSummary);

        await storage.saveSession(currentUser.id, currentExam.id, {
            type: 'audio-summary',
            content: audioSummary,
            originalText: text
        });
        await loadHistory();
    } catch (error) {
        alert('Error al generar resumen de audio: ' + error.message);
    } finally {
        ui.toggleLoading(false);
    }
}

async function handleFlashcards() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto.');
    if (text.length > 25000) return alert('El texto es demasiado largo (~25000 caracteres máx). Por favor, redúcelo.');
    if (!currentExam) return alert('Selecciona o crea un examen antes de guardar.');

    ui.toggleLoading(true);
    try {
        const cards = await api.generateFlashcards(text, flashcardCount);
        ui.renderFlashcards(cards, (card) => explainFlashcard(text, card));

        await storage.saveSession(currentUser.id, currentExam.id, {
            type: 'flashcard',
            content: cards,
            originalText: text,
            meta: { count: flashcardCount }
        });
        await loadHistory();
    } catch (error) {
        alert('Error al generar flashcards: ' + error.message);
    } finally {
        ui.toggleLoading(false);
    }
}

function explainFlashcard(text, card) {
    currentContext = text;
    chatHistory = [];
    ui.renderChatInterface(handleChatMessage);
    
    // Automatically send a question about the flashcard
    const question = `Explica me esta pregunta y respuesta:\n\nPregunta: ${card.question}\n\nRespuesta: ${card.answer}`;
    
    // Send the message after a small delay to ensure UI is ready
    setTimeout(() => {
        handleChatMessage(question);
    }, 100);
}

function initializeChat() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto para chatear sobre él.');
    if (text.length > 25000) return alert('El texto es demasiado largo (~25000 caracteres máx). Por favor, redúcelo.');

    currentContext = text;
    chatHistory = []; // Reset history on new chat start
    ui.renderChatInterface(handleChatMessage);
}

async function handleChatMessage(message) {
    if (!message) return;

    ui.appendChatMessage('user', message);

    try {
        const response = await api.chatWithContext(currentContext, message, chatHistory);
        ui.appendChatMessage('ai', response);

        chatHistory.push({ role: 'user', content: message });
        chatHistory.push({ role: 'assistant', content: response });
    } catch (error) {
        ui.appendChatMessage('ai', 'Error: ' + error.message);
        console.error(error);
    }
}


async function loadHistory() {
    if (!currentUser || !currentExam) {
        ui.updateHistoryList([], () => {}, () => {});
        return;
    }

    const history = await storage.loadSessions(currentUser.id, currentExam.id);
    ui.updateHistoryList(
        history,
        async (id) => {
            await storage.deleteSession(currentUser.id, currentExam.id, id);
            await loadHistory();
        },
        (session) => {
            ui.elements.inputArea.value = session.originalText;
            if (session.type === 'summary') {
                ui.renderSummary(session.content);
            } else if (session.type === 'audio-summary') {
                ui.renderAudioSummary(session.content);
            } else if (session.type === 'flashcard') {
                ui.renderFlashcards(session.content, (card) => explainFlashcard(session.originalText || ui.elements.inputArea.value, card));
            } else if (session.type === 'test') {
                // show test in read-only review mode (allows "Volver a hacer" to start interactive)
                const questions = session.content.questions || [];
                if (!questions.length) return alert('No hay preguntas guardadas para esta sesión.');
                const userAnswers = session.content.userAnswers || null;
                ui.renderTest(questions, async (result) => {
                    // if user repeats the test and finishes, save new session
                    await storage.saveSession(currentUser.id, currentExam.id, {
                        type: 'test',
                        content: { questions: result.questions, userAnswers: result.userAnswers || [], score: result.score, correctCount: result.correctCount },
                        originalText: session.originalText || ui.elements.inputArea.value,
                        meta: { count: result.total }
                    });
                    await loadHistory();
                }, { 
                    readOnly: true, 
                    userAnswers,
                    onExpertAdvice: (qs, answers, container, btn) => handleExpertAdvice(session.originalText || ui.elements.inputArea.value, qs, answers, container, btn)
                });
            } else if (session.type === 'chat') {
                // Restore chat if implemented
            }
        }
    );
}

// PDF Management Functions
function addPDFToList(filename, textContent, providedId) {
    const id = providedId || (Date.now() + Math.random());
    if (!loadedPDFs.find(p => p.id === id)) {
        loadedPDFs.push({
            id,
            name: filename,
            text: textContent
        });
        updatePDFListUI();
        updateTextAreaFromPDFs();
    }
}

async function removePDFFromList(id) {
    loadedPDFs = loadedPDFs.filter(pdf => String(pdf.id) !== String(id));
    updatePDFListUI();
    updateTextAreaFromPDFs();
    
    if (currentUser && currentExam && !currentExam.isLocal) {
        try {
            await storage.removePdfFromExam(currentUser.id, currentExam.id, id);
        } catch (err) {
            console.error("Failed to remove PDF from cloud", err);
        }
    }
}

function updateTextAreaFromPDFs() {
    if (loadedPDFs.length > 0) {
        const combinedText = loadedPDFs.map(pdf => pdf.text).join('\n\n--- Nueva página ---\n\n');
        ui.elements.inputArea.value = combinedText;
        ui.elements.inputArea.dispatchEvent(new Event('input'));
    }
}

function updatePDFListUI() {
    const container = document.getElementById('pdfs-container');
    const list = document.getElementById('pdfs-list');
    
    if (loadedPDFs.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    list.innerHTML = loadedPDFs.map(pdf => `
        <div class="pdf-item" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background-color: #ffffff; border-radius: var(--radius-sm); font-size: 0.85rem;">
            <span style="flex: 1; word-break: break-word;">📄 ${escapeHtml(pdf.name)}</span>
            <button class="btn-remove-pdf" data-pdf-id="${pdf.id}" style="padding: 0.25rem 0.5rem; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1rem;" title="Eliminar PDF">✕</button>
        </div>
    `).join('');
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.btn-remove-pdf').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.target.closest('.btn-remove-pdf');
            const pdfId = btnEl.getAttribute('data-pdf-id');
            removePDFFromList(pdfId);
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showCustomAlert(message, customIcon = '🛡️') {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    const box = document.createElement('div');
    box.style.backgroundColor = 'var(--background-color, #ffffff)';
    box.style.padding = '2rem';
    box.style.borderRadius = 'var(--radius-md, 12px)';
    box.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
    box.style.maxWidth = '400px';
    box.style.width = '90%';
    box.style.textAlign = 'center';
    box.style.transform = 'translateY(-20px)';
    box.style.transition = 'transform 0.3s ease';

    const icon = document.createElement('div');
    icon.innerHTML = customIcon;
    icon.style.fontSize = '3rem';
    icon.style.marginBottom = '1rem';

    const text = document.createElement('p');
    text.textContent = message;
    text.style.fontSize = '1.1rem';
    text.style.color = 'var(--text-color, #333)';
    text.style.marginBottom = '1.5rem';
    text.style.lineHeight = '1.5';
    text.style.whiteSpace = 'pre-wrap';

    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = 'Entendido';
    btn.style.width = '100%';
    btn.style.marginTop = '1rem';
    
    btn.addEventListener('click', () => {
        overlay.style.opacity = '0';
        box.style.transform = 'translateY(-20px)';
        setTimeout(() => overlay.remove(), 300);
    });

    box.appendChild(icon);
    box.appendChild(text);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Trigger animation next frame
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });
}

async function handleExpertAdvice(text, qs, answers, container, btn) {
    if (!text) return showCustomAlert('No hay texto original para aconsejar.');
    
    // Filter incorrect answers
    const incorrect = qs.map((q, i) => {
        const a = answers[i];
        if (!a || !a.correct) {
            return {
                question: q.question,
                userAnswer: a ? q.options[a.selected].text : 'No respondida',
                correctAnswer: q.options.find(o => o.correct)?.text
            };
        }
        return null;
    }).filter(Boolean);

    if (incorrect.length === 0) {
        return showCustomAlert('¡Has acertado todas! No necesitas consejos, ¡sigue así!');
    }

    btn.disabled = true;
    btn.innerHTML = '⏳ Entendiendo tus fallos...';

    try {
        const advice = await api.getExpertAdvice(text, incorrect);
        
        const div = document.createElement('div');
        div.className = 'advice-content fade-in';
        div.style.marginTop = '2rem';
        div.style.padding = '1.5rem';
        div.style.backgroundColor = 'var(--background-color)';
        div.style.borderRadius = 'var(--radius-md)';
        div.style.borderLeft = '4px solid #8b5cf6';
        div.innerHTML = `<h3 style="color: #8b5cf6; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;"><span>💡</span> Consejo del Experto</h3><div class="markdown-body" style="font-size: 0.95rem; line-height: 1.6;">${marked.parse(advice)}</div>`;
        
        container.appendChild(div);
        
        // Use requestAnimationFrame to let DOM update before scrolling
        requestAnimationFrame(() => {
             container.scrollTop = container.scrollHeight;
        });
        btn.style.display = 'none'; // hide button once clicked
    } catch (err) {
        console.error(err);
        showCustomAlert('Error obteniendo consejo: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = '💡 Consejo del Experto';
    }
}
