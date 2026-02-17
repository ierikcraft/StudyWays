import { db } from './firebase.js';
import { ref, set, get, remove, push } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js';

// Realtime DB structure:
// /users/{uid}/exams/{examId} -> { emoji, title, createdAt }
// /users/{uid}/exams/{examId}/sessions/{sessionId} -> session object

function ensureArg(arg, name) {
    if (!arg) throw new Error(`${name} is required`);
}

export async function listExams(uid) {
    ensureArg(uid, 'uid');
    const snap = await get(ref(db, `users/${uid}/exams`));
    const val = snap.val();
    if (!val) return [];
    return Object.entries(val).map(([id, data]) => ({ id, ...data }));
}

export async function createExam(uid, { emoji = '📘', title = 'Nuevo examen' } = {}) {
    ensureArg(uid, 'uid');
    const examsRef = ref(db, `users/${uid}/exams`);
    const newRef = push(examsRef);
    const exam = { emoji, title, createdAt: Date.now() };
    await set(newRef, exam);
    return { id: newRef.key, ...exam };
}

export async function deleteExam(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    await remove(ref(db, `users/${uid}/exams/${examId}`));
}

export async function saveSession(uid, examId, data) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    const session = {
        id: Date.now(),
        date: new Date().toISOString(),
        ...data
    };
    await set(ref(db, `users/${uid}/exams/${examId}/sessions/${session.id}`), session);
    return session;
}

export async function loadSessions(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    const snap = await get(ref(db, `users/${uid}/exams/${examId}/sessions`));
    const val = snap.val();
    if (!val) return [];
    const arr = Object.entries(val).map(([id, s]) => ({ id, ...s }));
    // sort by numeric id (timestamp) desc
    arr.sort((a, b) => Number(b.id) - Number(a.id));
    return arr;
}

export async function deleteSession(uid, examId, sessionId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    ensureArg(sessionId, 'sessionId');
    await remove(ref(db, `users/${uid}/exams/${examId}/sessions/${sessionId}`));
}

export async function clearHistory(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    await remove(ref(db, `users/${uid}/exams/${examId}/sessions`));
}
