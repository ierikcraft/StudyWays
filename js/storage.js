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
