const NOTEBOOKS_KEY = 'studyways_notebooks';
const OLD_STORAGE_KEY = 'studyways_data';

// --- Migration ---
function migrateOldData() {
    const oldData = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldData && !localStorage.getItem(NOTEBOOKS_KEY)) {
        const history = JSON.parse(oldData);
        const notebook = {
            id: Date.now().toString(),
            title: 'General',
            sourceText: '',
            history: history,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        saveNotebooks([notebook]);
        localStorage.removeItem(OLD_STORAGE_KEY);
        return notebook.id;
    }
    return null;
}

// --- Core ---
function getNotebooks() {
    const data = localStorage.getItem(NOTEBOOKS_KEY);
    return data ? JSON.parse(data) : [];
}

function saveNotebooks(notebooks) {
    localStorage.setItem(NOTEBOOKS_KEY, JSON.stringify(notebooks));
}

// --- CRUD ---
export function getAllNotebooks() {
    // Check migration
    migrateOldData();
    return getNotebooks().sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
}

export function getNotebook(id) {
    const notebooks = getNotebooks();
    return notebooks.find(n => n.id === id) || null;
}

export function createNotebook(title) {
    const notebooks = getNotebooks();
    const newNotebook = {
        id: Date.now().toString(),
        title: title || 'Nuevo Cuaderno',
        sourceText: '',
        history: [], // summaries, flashcards, chats
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
    };
    notebooks.unshift(newNotebook);
    saveNotebooks(notebooks);
    return newNotebook;
}

export function updateNotebook(id, updates) {
    const notebooks = getNotebooks();
    const index = notebooks.findIndex(n => n.id === id);
    if (index !== -1) {
        notebooks[index] = {
            ...notebooks[index],
            ...updates,
            lastModified: new Date().toISOString()
        };
        saveNotebooks(notebooks);
        return notebooks[index];
    }
    return null;
}

export function deleteNotebook(id) {
    const notebooks = getNotebooks();
    const filtered = notebooks.filter(n => n.id !== id);
    saveNotebooks(filtered);
}

export function addHistoryToNotebook(notebookId, item) {
    const notebook = getNotebook(notebookId);
    if (notebook) {
        const historyItem = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            ...item
        };
        notebook.history.unshift(historyItem);
        updateNotebook(notebookId, { history: notebook.history });
        return historyItem;
    }
    return null;
}

export function removeHistoryFromNotebook(notebookId, historyId) {
    const notebook = getNotebook(notebookId);
    if (notebook) {
        const newHistory = notebook.history.filter(h => h.id !== historyId);
        updateNotebook(notebookId, { history: newHistory });
    }
}
