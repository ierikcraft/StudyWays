import * as api from './api.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import * as auth from './auth.js';
import * as pdfUtils from './pdf_utils.js';

let flashcardCount = 5;
let chatHistory = [];
let currentContext = '';
let activeNotebookId = null;
let saveTimeout;

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    let user = auth.getUser();
    if (!user) {
        user = auth.handleAuthCallback();
    }

    if (user) {
        initApp(user);
    } else {
        showLanding();
    }

    // Global Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Auth
    document.getElementById('btn-login').addEventListener('click', auth.login);
    document.getElementById('btn-logout').addEventListener('click', auth.logout);
    ui.elements.dashBtnLogout.addEventListener('click', auth.logout);

    // Dashboard
    ui.elements.btnCreateNotebook.addEventListener('click', handleNewNotebook);
    ui.elements.btnBackDashboard.addEventListener('click', showDashboard);

    // Workspace Actions
    ui.elements.actionSummary.addEventListener('click', handleSummary);
    ui.elements.actionFlashcards.addEventListener('click', handleFlashcards);
    ui.elements.actionChat.addEventListener('click', initializeChat);

    // Auto-save input
    ui.elements.inputArea.addEventListener('input', (e) => {
        updateCharCount(e);
        scheduleSave();
    });

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
                ui.elements.inputArea.dispatchEvent(new Event('input'));
            } catch (error) {
                alert('Error al leer el PDF: ' + error.message);
            } finally {
                ui.toggleLoading(false);
                fileInput.value = '';
            }
        }
    });

    // Settings Modal
    ui.elements.actionSettings.addEventListener('click', () => ui.elements.modal.classList.remove('hidden'));
    ui.elements.closeModal.addEventListener('click', () => ui.elements.modal.classList.add('hidden'));
    ui.elements.saveSettings.addEventListener('click', () => {
        flashcardCount = ui.elements.flashcardCountInput.value;
        ui.elements.modal.classList.add('hidden');
    });
    ui.elements.flashcardCountInput.addEventListener('input', (e) => {
        ui.elements.flashcardCountInfo.textContent = e.target.value;
    });
    window.addEventListener('click', (e) => {
        if (e.target === ui.elements.modal) ui.elements.modal.classList.add('hidden');
    });
}

function initApp(user) {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

    // Dashboard User Info
    ui.elements.dashUserName.textContent = user.name;

    showDashboard();
}

function showLanding() {
    document.getElementById('landing-page').classList.remove('hidden');
    ui.elements.dashboard.classList.add('hidden');
    document.getElementById('app-container').classList.add('hidden');
}

function showDashboard() {
    activeNotebookId = null;
    document.getElementById('app-container').classList.add('hidden');
    ui.elements.dashboard.classList.remove('hidden');

    const notebooks = storage.getAllNotebooks();
    ui.renderDashboard(notebooks, selectNotebook, handleDeleteNotebook);
}

function showWorkspace() {
    ui.elements.dashboard.classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
}

// --- Notebook Logic ---

function selectNotebook(id) {
    activeNotebookId = id;
    const notebook = storage.getNotebook(id);
    if (!notebook) return showDashboard(); // Safety check

    // Restore text
    ui.elements.inputArea.value = notebook.sourceText || '';
    updateCharCount({ target: ui.elements.inputArea });

    // Render history
    // Since we removed sidebar history list for specific notebook, we need to ensure renderHistoryItem works.
    // Wait, the user wanted "squares for notebooks" (dashboard) and "history different inside each one".
    // The sidebar IS the history for the active notebook now.
    ui.updateHistoryList(
        notebook.history,
        (historyId) => {
            storage.removeHistoryFromNotebook(activeNotebookId, historyId);
            // Refresh history view
            const updatedNb = storage.getNotebook(activeNotebookId);
            ui.updateHistoryList(
                updatedNb.history,
                (hId) => {
                    storage.removeHistoryFromNotebook(activeNotebookId, hId);
                    selectNotebook(activeNotebookId);
                },
                (hItem) => {
                    if (hItem.type === 'summary') {
                        ui.renderSummary(hItem.content);
                    } else if (hItem.type === 'flashcard') {
                        ui.renderFlashcards(hItem.content);
                    }
                }
            );
        },
        (historyItem) => {
            if (historyItem.type === 'summary') {
                ui.renderSummary(historyItem.content);
            } else if (historyItem.type === 'flashcard') {
                ui.renderFlashcards(historyItem.content);
            }
        }
    );

    // Clear output area initially when opening notebook? Or keep blank?
    ui.elements.outputArea.innerHTML = '<div class="placeholder-state"><p>Selecciona un ítem del historial o genera nuevo contenido.</p></div>';

    showWorkspace();
}

function handleNewNotebook() {
    const title = ui.promptNewNotebook();
    if (title) {
        const newNb = storage.createNotebook(title);
        selectNotebook(newNb.id);
    }
}

function handleDeleteNotebook(id) {
    storage.deleteNotebook(id);
    showDashboard();
}

function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        if (activeNotebookId) {
            storage.updateNotebook(activeNotebookId, {
                sourceText: ui.elements.inputArea.value
            });
        }
    }, 1000);
}

function updateCharCount(e) {
    const count = e.target.value ? e.target.value.length : 0;
    document.getElementById('char-count').textContent = `${count} caracteres`;
}

// --- Features ---

async function handleSummary() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto.');

    ui.toggleLoading(true);
    try {
        const summary = await api.generateSummary(text);
        ui.renderSummary(summary);

        if (activeNotebookId) {
            storage.addHistoryToNotebook(activeNotebookId, {
                type: 'summary',
                content: summary,
                originalText: text
            });

            // Auto-Title Logic
            const notebook = storage.getNotebook(activeNotebookId);
            if (notebook && (notebook.title === 'Nuevo Cuaderno' || notebook.title === 'Mi primer cuaderno')) {
                // Generate title in background
                api.generateTitle(text).then(newTitle => {
                    if (newTitle) {
                        storage.updateNotebook(activeNotebookId, { title: newTitle });
                        // We don't need to refresh UI immediately unless we update sidebar title,
                        // but sidebar is history now. Title is only visible in Dashboard?
                        // Or maybe we should show Notebook Title in Top Bar!
                    }
                });
            }

            selectNotebook(activeNotebookId); // Update history list
        }
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

        if (activeNotebookId) {
            storage.addHistoryToNotebook(activeNotebookId, {
                type: 'flashcard',
                content: cards,
                originalText: text,
                meta: { count: flashcardCount }
            });
            selectNotebook(activeNotebookId);
        }
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
    chatHistory = [];
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
