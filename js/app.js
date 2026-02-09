import * as api from './api.js';
import * as storage from './storage.js';
import * as ui from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();

    document.getElementById('btn-summary').addEventListener('click', handleSummary);
    document.getElementById('btn-flashcards').addEventListener('click', handleFlashcards);
    document.getElementById('input-text').addEventListener('input', updateCharCount);
});

function updateCharCount(e) {
    const count = e.target.value.length;
    document.getElementById('char-count').textContent = `${count} caracteres`;
}

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
        const cards = await api.generateFlashcards(text);
        ui.renderFlashcards(cards);

        storage.saveSession({
            type: 'flashcard',
            content: cards,
            originalText: text
        });
        loadHistory();
    } catch (error) {
        alert('Error al generar flashcards: ' + error.message);
    } finally {
        ui.toggleLoading(false);
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
            } else {
                ui.renderFlashcards(session.content);
            }
        }
    );
}
