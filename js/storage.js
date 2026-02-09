const NOTEBOOKS_KEY = 'studyways_notebooks';
const OLD_STORAGE_KEY = 'studyways_data';
let currentUser = null;
let firebaseModule = null;

// Lazy load helper
async function getFirebase() {
    if (firebaseModule) return firebaseModule;
    try {
        firebaseModule = await import('./firebase.js');
        return firebaseModule;
    } catch (error) {
        console.error("Failed to load Firebase module:", error);
        return null;
    }
}

export function setCurrentUser(user) {
    currentUser = user;
}

// --- Local Helpers ---
function getLocalNotebooks() {
    const data = localStorage.getItem(NOTEBOOKS_KEY);
    const parsed = data ? JSON.parse(data) : [];
    return parsed.map(nb => ({ ...nb, source: 'local' }));
}

function saveLocalNotebooks(notebooks) {
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
    migrateOldData();

    // 1. Get Local
    const localNotebooks = getLocalNotebooks();

    // 2. Get Cloud (if user logged in & firebase available)
    let cloudNotebooks = [];
    if (currentUser && currentUser.id) {
        const fb = await getFirebase();
        if (fb) {
            try {
                cloudNotebooks = await fb.getUserNotebooks(currentUser.id);
            } catch (e) {
                console.error("Failed to load cloud notebooks:", e);
            }
        }
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
    const fb = await getFirebase();

    // Default to cloud ONLY if user logged in AND firebase loaded
    const canUseCloud = currentUser && currentUser.id && fb;

    const newNotebook = {
        id: Date.now().toString(),
        title: title || 'Nuevo Cuaderno',
        sourceText: '',
        history: [],
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        source: canUseCloud ? 'cloud' : 'local'
    };

    if (newNotebook.source === 'cloud') {
        try {
            await fb.saveNotebookToCloud(currentUser.id, newNotebook);
        } catch (err) {
            console.error("Cloud creation failed, falling back to local:", err);
            newNotebook.source = 'local';
            newNotebook.title += ' (Local)';
            const local = getLocalNotebooks();
            local.unshift(newNotebook);
            saveLocalNotebooks(local);
            alert("No se pudo conectar a la nube. Se ha creado el cuaderno en modo Local.");
        }
    } else {
        const local = getLocalNotebooks();
        local.unshift(newNotebook);
        saveLocalNotebooks(local);
    }

    return newNotebook;
}

export async function updateNotebook(id, updates) {
    let notebook = await getNotebook(id);
    if (!notebook) return null;

    const updatedNotebook = {
        ...notebook,
        ...updates,
        lastModified: new Date().toISOString()
    };

    if (updatedNotebook.source === 'cloud') {
        const fb = await getFirebase();
        if (fb && currentUser && currentUser.id) {
            try {
                await fb.saveNotebookToCloud(currentUser.id, updatedNotebook);
            } catch (err) {
                console.error("Cloud update failed:", err);
                // Alerting on every auto-save might be annoying, logging for now
            }
        }
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
        const fb = await getFirebase();
        if (fb && currentUser && currentUser.id) {
            await fb.deleteNotebookFromCloud(currentUser.id, id);
        }
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
