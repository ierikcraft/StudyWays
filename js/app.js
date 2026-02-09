import * as api from './api.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import * as auth from './auth.js';
import * as pdfUtils from './pdf_utils.js';

let flashcardCount = 5;
let chatHistory = [];
let currentContext = '';

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    let user = auth.getUser();
    if (!user) {
        user = auth.handleAuthCallback();
    }

    if (user) {
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

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === ui.elements.modal) closeSettings();
    });
});

function showApp(user) {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('user-name').textContent = user.name;
    // Optional: Set avatar if available or initials
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

    loadHistory();
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

    ui.toggleLoading(true);
    try {
        const summary = await api.generateSummary(text);
        ui.renderSummary(summary);

        storage.saveSession({
            type: 'summary',
            content: summary,
            originalText: text
        });
        loadHistory();
    } catch (error) {
        alert('Error al generar resumen: ' + error.message);
    } finally {
        ui.toggleLoading(false);
    }
}

async function handleFlashcards() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto.');

    ui.toggleLoading(true);
    try {
        const cards = await api.generateFlashcards(text, flashcardCount);
        ui.renderFlashcards(cards);

        storage.saveSession({
            type: 'flashcard',
            content: cards,
            originalText: text,
            meta: { count: flashcardCount }
        });
        loadHistory();
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

    // Optimistic UI or loading bubble could act here

    try {
        const response = await api.chatWithContext(currentContext, message, chatHistory);
        ui.appendChatMessage('ai', response);

        chatHistory.push({ role: 'user', content: message });
        chatHistory.push({ role: 'assistant', content: response });

        // Save chat session? Maybe only on exit or periodically. 
        // For now, simpler to not save every message to history list to avoid clutter,
        // or update an existing session object.
    } catch (error) {
        ui.appendChatMessage('ai', 'Error: No pude conectar con el servicio.');
        console.error(error);
    }
}


function loadHistory() {
    const history = storage.loadSessions();
    ui.updateHistoryList(
        history,
        (id) => {
            storage.deleteSession(id);
            loadHistory();
        },
        (session) => {
            ui.elements.inputArea.value = session.originalText;
            if (session.type === 'summary') {
                ui.renderSummary(session.content);
            } else if (session.type === 'flashcard') {
                ui.renderFlashcards(session.content);
            } else if (session.type === 'chat') {
                // Restore chat if we implemented saving it
            }
        }
    );
}
