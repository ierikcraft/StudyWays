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

    // Main Actions
    ui.elements.actionSummary.addEventListener('click', handleSummary);
    ui.elements.actionFlashcards.addEventListener('click', handleFlashcards);
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

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === ui.elements.modal) closeSettings();
        if (e.target === ui.elements.createExamModal) closeCreateExamModal();
    });

    // If user already logged in, load their exams
    if (currentUser) loadExams();
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
        alert('No se pudieron cargar los exámenes. Comprueba la conexión a Firebase.');
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
    const emoji = ui.elements.examEmojiInput.value.trim() || '📘';
    const title = ui.elements.examTitleInput.value.trim() || 'Nuevo examen';
    try {
        const exam = await storage.createExam(currentUser.id, { emoji, title });
        closeCreateExamModal();
        await refreshExamsList();
        selectExam(exam);
    } catch (err) {
        console.error(err);
        alert('No se pudo crear el examen.');
    }
}

function showApp(user) {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('user-name').textContent = user.name;
    // Optional: Set avatar if available or initials
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

    // load user exams + history
    loadExams();
}

function showLanding() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

function updateCharCount(e) {
    const count = e.target.value.length;
    document.getElementById('char-count').textContent = `${count} caracteres`;
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
