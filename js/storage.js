import * as firebase from './firebase.js';

const NOTEBOOKS_KEY = 'studyways_notebooks';
const OLD_STORAGE_KEY = 'studyways_data';
let currentUser = null;

export function setCurrentUser(user) {
    currentUser = user;
}

// --- Local Helpers ---
function getLocalNotebooks() {
    const data = localStorage.getItem(NOTEBOOKS_KEY);
    const parsed = data ? JSON.parse(data) : [];
    // Ensure all local notebooks have source='local'
    return parsed.map(nb => ({ ...nb, source: 'local' }));
}

function saveLocalNotebooks(notebooks) {
    // Filter out cloud notebooks just in case
    const localOnly = notebooks.filter(n => n.source === 'local');
    localStorage.setItem(NOTEBOOKS_KEY, JSON.stringify(localOnly));
}

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
            lastModified: new Date().toISOString(),
            source: 'local'
        };
        saveLocalNotebooks([notebook]);
        localStorage.removeItem(OLD_STORAGE_KEY);
        return notebook.id;
    }
    return null;
}

// --- CRUD Operations (ASYNC) ---

export async function getAllNotebooks() {
    // Check migration first
    migrateOldData();

    // 1. Get Local
    const localNotebooks = getLocalNotebooks();

    // 2. Get Cloud (if user logged in)
    let cloudNotebooks = [];
    if (currentUser && currentUser.id) {
        cloudNotebooks = await firebase.getUserNotebooks(currentUser.id);
    }

    // 3. Merge and Sort
    const all = [...localNotebooks, ...cloudNotebooks];
    return all.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
}

export async function getNotebook(id) {
    const all = await getAllNotebooks();
    return all.find(n => n.id === id) || null;
}

export async function createNotebook(title) {
    const newNotebook = {
        id: Date.now().toString(),
        title: title || 'Nuevo Cuaderno',
        sourceText: '',
        history: [],
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        source: (currentUser && currentUser.id) ? 'cloud' : 'local'
    };

    if (newNotebook.source === 'cloud') {
        await firebase.saveNotebookToCloud(currentUser.id, newNotebook);
    } else {
        const local = getLocalNotebooks();
        local.unshift(newNotebook);
        saveLocalNotebooks(local);
    }

    return newNotebook;
}

export async function updateNotebook(id, updates) {
    const notebook = await getNotebook(id);
    if (!notebook) return null;

    const updatedNotebook = {
        ...notebook,
        ...updates,
        lastModified: new Date().toISOString()
    };

    if (updatedNotebook.source === 'cloud') {
        if (!currentUser || !currentUser.id) throw new Error('User not logged in');
        await firebase.saveNotebookToCloud(currentUser.id, updatedNotebook);
    } else {
        const local = getLocalNotebooks();
        const index = local.findIndex(n => n.id === id);
        if (index !== -1) {
            local[index] = updatedNotebook;
            saveLocalNotebooks(local);
        }
    }

    return updatedNotebook;
}

export async function deleteNotebook(id) {
    const notebook = await getNotebook(id);
    if (!notebook) return;

    if (notebook.source === 'cloud') {
        if (!currentUser || !currentUser.id) return;
        await firebase.deleteNotebookFromCloud(currentUser.id, id);
    } else {
        const local = getLocalNotebooks();
        const filtered = local.filter(n => n.id !== id);
        saveLocalNotebooks(filtered);
    }
}

export async function addHistoryToNotebook(notebookId, item) {
    const notebook = await getNotebook(notebookId);
    if (notebook) {
        const historyItem = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            ...item
        };
        // Create new history array explicitly to ensure reactivity/save
        const newHistory = [historyItem, ...(notebook.history || [])];
        await updateNotebook(notebookId, { history: newHistory });
        return historyItem;
    }
    return null;
}

export async function removeHistoryFromNotebook(notebookId, historyId) {
    const notebook = await getNotebook(notebookId);
    if (notebook) {
        const newHistory = notebook.history.filter(h => h.id !== historyId);
        await updateNotebook(notebookId, { history: newHistory });
    }
}
