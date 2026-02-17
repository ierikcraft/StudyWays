import * as api from './api.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import * as auth from './auth.js';
import * as pdfUtils from './pdf_utils.js';

let flashcardCount = 5;
let chatHistory = [];
let currentContext = '';
let currentUser = null;
let currentExam = null;

document.addEventListener('DOMContentLoaded', () => {
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
    ui.elements.actionFlashcards.addEventListener('click', handleFlashcards);
    ui.elements.actionTest.addEventListener('click', handleTest);
    ui.elements.actionChat.addEventListener('click', initializeChat);
    document.getElementById('input-text').addEventListener('input', updateCharCount);

    // PDF Upload
    const btnUpload = document.getElementById('btn-upload-pdf');
    const fileInput = document.getElementById('pdf-upload');

    btnUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            ui.toggleLoading(true);
            try {
                const text = await pdfUtils.extractTextFromPDF(file);
                ui.elements.inputArea.value = text;
                // Trigger input event to update char count
                ui.elements.inputArea.dispatchEvent(new Event('input'));
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
    });

    // If user already logged in, show notebook dashboard (local-only storage)
    if (currentUser) {
        showNotebookDashboard();
    }
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

function selectExam(exam) {
    currentExam = exam;
    ui.markExamSelected(exam.id);
    loadHistory();
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
    const grid = document.getElementById('notebooks-grid');
    grid.querySelectorAll('.notebook-card.item').forEach(n => n.remove());

    try {
        const exams = await storage.listExams(currentUser.id);
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
    if (!text) return alert('Por favor ingresa un texto para generar el test.');
    if (!currentExam) return alert('Selecciona o crea un examen antes de guardar.');

    // Ask user how many questions
    const defaultCount = Number(ui.elements.flashcardCountInput.value) || 5;
    const raw = prompt('¿Cuántas preguntas quieres en el test? (1-50)', String(defaultCount));
    if (raw === null) return; // user cancelled
    const count = parseInt(raw, 10);
    if (!Number.isInteger(count) || count < 1 || count > 50) return alert('Introduce un número válido entre 1 y 50.');

    ui.toggleLoading(true);
    try {
        const questions = await api.generateTest(text, count);

        // Shuffle questions and shuffle options inside each question
        shuffleArray(questions);
        questions.forEach(q => shuffleArray(q.options));

        // Update title to reflect count
        elements = ui.elements;
        elements.contentTitle.textContent = `Test — ${count} preguntas`;

        // Render test UI
        ui.renderTest(questions, async (result) => {
            // Save test session (include meta.count)
            await storage.saveSession(currentUser.id, currentExam.id, {
                type: 'test',
                content: { questions: result.questions, score: result.score, correctCount: result.correctCount },
                originalText: text,
                meta: { count }
            });
            await loadHistory();
        });
    } catch (err) {
        console.error(err);
        alert('Error generando test: ' + err.message);
    } finally {
        ui.toggleLoading(false);
    }
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

async function handleFlashcards() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto.');
    if (!currentExam) return alert('Selecciona o crea un examen antes de guardar.');

    ui.toggleLoading(true);
    try {
        const cards = await api.generateFlashcards(text, flashcardCount);
        ui.renderFlashcards(cards);

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

function initializeChat() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto para chatear sobre él.');

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
        ui.appendChatMessage('ai', 'Error: No pude conectar con el servicio.');
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
            } else if (session.type === 'flashcard') {
                ui.renderFlashcards(session.content);
            } else if (session.type === 'chat') {
                // Restore chat if implemented
            }
        }
    );
}
