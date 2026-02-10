const STORAGE_KEY = 'studyways_data';

export function saveSession(data) {
    const currentData = loadSessions();
    const session = {
        id: Date.now(),
        date: new Date().toISOString(),
        ...data // type (summary/flashcard), content, originalText
    };
    currentData.unshift(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
    return session;
}

export function loadSessions() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

export function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
}

export function deleteSession(id) {
    const sessions = loadSessions();
    const filtered = sessions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
}
