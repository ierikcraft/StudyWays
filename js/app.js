```javascript
import * as api from './api.js';
import * as storage from './storage.js';
import * as ui from './ui.js';

let flashcardCount = 5;
let chatHistory = [];
let currentContext = '';

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();

    // Main Actions
    ui.elements.actionSummary.addEventListener('click', handleSummary);
    ui.elements.actionFlashcards.addEventListener('click', handleFlashcards);
    ui.elements.actionChat.addEventListener('click', initializeChat);
    document.getElementById('input-text').addEventListener('input', updateCharCount);

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

function updateCharCount(e) {
    const count = e.target.value.length;
    document.getElementById('char-count').textContent = `${ count } caracteres`;
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
```
