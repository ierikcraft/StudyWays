import { db } from './firebase.js';
import { ref, set, get, remove, push } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js';

// Realtime DB structure (primary). Fallback to localStorage when Firebase operations fail.
// /users/{uid}/exams/{examId} -> { emoji, title, createdAt }
// /users/{uid}/exams/{examId}/sessions/{sessionId} -> session object

function ensureArg(arg, name) {
    if (!arg) throw new Error(`${name} is required`);
}

// --- LocalStorage fallback helpers ---
function localExamsKey(uid) { return `studyways_local_exams_${uid}`; }
function localSessionsKey(uid, examId) { return `studyways_local_sessions_${uid}_${examId}`; }

function localListExams(uid) {
    const raw = localStorage.getItem(localExamsKey(uid));
    return raw ? JSON.parse(raw) : [];
}

function localSaveExams(uid, arr) {
    localStorage.setItem(localExamsKey(uid), JSON.stringify(arr));
}

function localCreateExam(uid, exam) {
    const list = localListExams(uid);
    const id = String(Date.now());
    const e = { id, ...exam };
    list.unshift(e);
    localSaveExams(uid, list);
    return e;
}

function localDeleteExam(uid, examId) {
    const list = localListExams(uid).filter(x => x.id !== String(examId));
    localSaveExams(uid, list);
    // remove sessions for that exam
    localStorage.removeItem(localSessionsKey(uid, examId));
}

function localSaveSession(uid, examId, session) {
    const key = localSessionsKey(uid, examId);
    const raw = localStorage.getItem(key);
    const obj = raw ? JSON.parse(raw) : {};
    obj[session.id] = session;
    localStorage.setItem(key, JSON.stringify(obj));
}

function localLoadSessions(uid, examId) {
    const key = localSessionsKey(uid, examId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const obj = JSON.parse(raw);
    const arr = Object.entries(obj).map(([id, s]) => ({ id, ...s }));
    arr.sort((a, b) => Number(b.id) - Number(a.id));
    return arr;
}

function localDeleteSession(uid, examId, sessionId) {
    const key = localSessionsKey(uid, examId);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const obj = JSON.parse(raw);
    delete obj[sessionId];
    localStorage.setItem(key, JSON.stringify(obj));
}

function localClearHistory(uid, examId) {
    localStorage.removeItem(localSessionsKey(uid, examId));
}

// --- Public API with Firebase primary + local fallback ---
export async function listExams(uid) {
    ensureArg(uid, 'uid');
    try {
        const snap = await get(ref(db, `users/${uid}/exams`));
        const val = snap.val();
        if (!val) return [];
        return Object.entries(val).map(([id, data]) => ({ id, ...data }));
    } catch (err) {
        console.warn('Firebase listExams failed, using local fallback', err.message);
        return localListExams(uid);
    }
}

export async function createExam(uid, { emoji = '📘', title = 'Nuevo examen' } = {}) {
    ensureArg(uid, 'uid');
    const exam = { emoji, title, createdAt: Date.now() };
    try {
        const examsRef = ref(db, `users/${uid}/exams`);
        const newRef = push(examsRef);
        await set(newRef, exam);
        return { id: newRef.key, ...exam };
    } catch (err) {
        console.warn('Firebase createExam failed, falling back to localStorage', err.message);
        return localCreateExam(uid, exam);
    }
}

export async function deleteExam(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    try {
        await remove(ref(db, `users/${uid}/exams/${examId}`));
    } catch (err) {
        console.warn('Firebase deleteExam failed, using local fallback', err.message);
        localDeleteExam(uid, examId);
    }
}

export async function saveSession(uid, examId, data) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    const session = {
        id: Date.now(),
        date: new Date().toISOString(),
        ...data
    };
    try {
        await set(ref(db, `users/${uid}/exams/${examId}/sessions/${session.id}`), session);
        return session;
    } catch (err) {
        console.warn('Firebase saveSession failed, saving locally', err.message);
        localSaveSession(uid, examId, session);
        return session;
    }
}

export async function loadSessions(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    try {
        const snap = await get(ref(db, `users/${uid}/exams/${examId}/sessions`));
        const val = snap.val();
        if (!val) return [];
        const arr = Object.entries(val).map(([id, s]) => ({ id, ...s }));
        arr.sort((a, b) => Number(b.id) - Number(a.id));
        return arr;
    } catch (err) {
        console.warn('Firebase loadSessions failed, using local fallback', err.message);
        return localLoadSessions(uid, examId);
    }
}

export async function deleteSession(uid, examId, sessionId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    ensureArg(sessionId, 'sessionId');
    try {
        await remove(ref(db, `users/${uid}/exams/${examId}/sessions/${sessionId}`));
    } catch (err) {
        console.warn('Firebase deleteSession failed, using local fallback', err.message);
        localDeleteSession(uid, examId, sessionId);
    }
}

export async function clearHistory(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    try {
        await remove(ref(db, `users/${uid}/exams/${examId}/sessions`));
    } catch (err) {
        console.warn('Firebase clearHistory failed, using local fallback', err.message);
        localClearHistory(uid, examId);
    }
}

// Migrate legacy localStorage data (old `studyways_data`) and sync pending local exams/sessions to Firebase when possible.
// Returns { migratedExams, migratedSessions }
export async function migrateLocalDataToRemote(uid) {
    ensureArg(uid, 'uid');
    let migratedExams = 0;
    let migratedSessions = 0;

    // 1) Migrate legacy single-key sessions (pre-exam implementation)
    try {
        const legacyKey = 'studyways_data';
        const raw = localStorage.getItem(legacyKey);
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length > 0) {
                // create a dedicated exam for imported sessions
                const importTitle = 'Importado (local)';
                const importExam = await createExam(uid, { emoji: '📥', title: importTitle });
                // Save each legacy session under the new exam
                for (const s of arr) {
                    // preserve original id/date when present
                    await saveSession(uid, importExam.id, s);
                    migratedSessions++;
                }
                // remove old legacy key
                localStorage.removeItem(legacyKey);
                // if importExam was newly created on remote (non-numeric id) count it as migrated
                if (!/^[0-9]+$/.test(String(importExam.id))) migratedExams++;
            }
        }
    } catch (err) {
        console.warn('Error migrating legacy sessions', err.message);
    }

    // 2) Sync any exams that were saved locally (fallback) to Firebase
    try {
        const localEx = localListExams(uid);
        for (const le of localEx) {
            // consider numeric IDs as local (timestamp-based)
            const isLocalId = /^[0-9]+$/.test(String(le.id));
            if (!isLocalId) continue; // likely already a server id

            // attempt to create on Firebase; createExam will try Firebase first
            const pushed = await createExam(uid, { emoji: le.emoji, title: le.title });

            // if creation produced a real firebase id (non-numeric), migrate sessions
            if (!/^[0-9]+$/.test(String(pushed.id))) {
                const sessions = localLoadSessions(uid, le.id);
                for (const s of sessions) {
                    await saveSession(uid, pushed.id, s);
                    migratedSessions++;
                }
                // remove old local exam + its sessions
                localDeleteExam(uid, le.id);
                migratedExams++;
            }
        }
    } catch (err) {
        console.warn('Error syncing local exams to remote', err.message);
    }

    return { migratedExams, migratedSessions };
}
