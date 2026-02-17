// LocalStorage-only storage implementation for StudyWays
// Keys per user: /exams and /sessions per exam

function ensureArg(arg, name) { if (!arg) throw new Error(`${name} is required`); }
function examsKey(uid) { return `studyways_exams_${uid}`; }
function sessionsKey(uid, examId) { return `studyways_sessions_${uid}_${examId}`; }

function readExams(uid) {
    const raw = localStorage.getItem(examsKey(uid));
    return raw ? JSON.parse(raw) : [];
}
function writeExams(uid, arr) { localStorage.setItem(examsKey(uid), JSON.stringify(arr)); }

export async function listExams(uid) {
    ensureArg(uid, 'uid');
    return readExams(uid);
}

export async function createExam(uid, { emoji = '📘', title = 'Nuevo examen' } = {}) {
    ensureArg(uid, 'uid');
    const exams = readExams(uid);
    const id = String(Date.now());
    const exam = { id, emoji, title, createdAt: Date.now() };
    exams.unshift(exam);
    writeExams(uid, exams);
    return exam;
}

export async function deleteExam(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    const exams = readExams(uid).filter(e => String(e.id) !== String(examId));
    writeExams(uid, exams);
    localStorage.removeItem(sessionsKey(uid, examId));
}

export async function saveSession(uid, examId, data) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    const key = sessionsKey(uid, examId);
    const raw = localStorage.getItem(key);
    const obj = raw ? JSON.parse(raw) : {};
    const id = String(Date.now());
    const session = { id, date: new Date().toISOString(), ...data };
    obj[session.id] = session;
    localStorage.setItem(key, JSON.stringify(obj));
    return session;
}

export async function loadSessions(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    const raw = localStorage.getItem(sessionsKey(uid, examId));
    if (!raw) return [];
    const obj = JSON.parse(raw);
    const arr = Object.entries(obj).map(([id, s]) => ({ id, ...s }));
    arr.sort((a, b) => Number(b.id) - Number(a.id));
    return arr;
}

export async function deleteSession(uid, examId, sessionId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    ensureArg(sessionId, 'sessionId');
    const key = sessionsKey(uid, examId);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const obj = JSON.parse(raw);
    delete obj[sessionId];
    localStorage.setItem(key, JSON.stringify(obj));
}

export async function clearHistory(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    localStorage.removeItem(sessionsKey(uid, examId));
}

