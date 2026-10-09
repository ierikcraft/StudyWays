import { db } from './firebase.js';
import { ref, set, get, push, remove, child, update } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

function ensureArg(arg, name) { if (!arg) throw new Error(`${name} is required`); }
function examsKey(uid) { return `studyways_exams_${uid}`; }
function sessionsKey(uid, examId) { return `studyways_sessions_${uid}_${examId}`; }

function readLocalExams(uid) {
    const raw = localStorage.getItem(examsKey(uid));
    return raw ? JSON.parse(raw) : [];
}
function writeLocalExams(uid, arr) { localStorage.setItem(examsKey(uid), JSON.stringify(arr)); }

export async function listExams(uid) {
    ensureArg(uid, 'uid');
    const localExams = readLocalExams(uid).map(e => ({ ...e, isLocal: true }));

    let fbExams = [];
    try {
        const snapshot = await get(ref(db, `users/${uid}/exams`));
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            const updates = {};
            let needsMigration = false;
            
            fbExams = Object.keys(data).map(key => {
                const exam = { id: key, ...data[key], isLocal: false };
                
                // Migrate PDFs to new location so they don't slow down future exam listings
                if (exam.pdfs) {
                    updates[`users/${uid}/exam_pdfs/${key}`] = exam.pdfs;
                    updates[`users/${uid}/exams/${key}/pdfs`] = null;
                    delete exam.pdfs;
                    needsMigration = true;
                }
                
                return exam;
            });
            
            if (needsMigration) {
                // Run migration in background
                update(ref(db), updates).catch(err => console.error("Migration error:", err));
            }
        }
    } catch (err) {
        console.error("Error fetching exams from Firebase:", err);
    }

    const combined = [...localExams, ...fbExams];
    
    const unique = [];
    const seen = new Set();
    for (const exam of combined) {
        if (!seen.has(exam.id)) {
            seen.add(exam.id);
            unique.push(exam);
        }
    }
    
    unique.sort((a, b) => b.createdAt - a.createdAt);
    return unique;
}

export async function createExam(uid, { emoji = '📘', title = 'Nuevo examen' } = {}) {
    ensureArg(uid, 'uid');

    // Write exclusively to Firebase
    const newExamRef = push(ref(db, `users/${uid}/exams`));
    const examData = { emoji, title, createdAt: Date.now() };
    await set(newExamRef, examData);

    return { id: newExamRef.key, ...examData, isLocal: false };
}

export async function deleteExam(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');

    const exams = readLocalExams(uid);
    const localExam = exams.find(e => String(e.id) === String(examId));

    if (localExam) {
        // Delete local
        const filtered = exams.filter(e => String(e.id) !== String(examId));
        writeLocalExams(uid, filtered);
        localStorage.removeItem(sessionsKey(uid, examId));
    } else {
        // Delete from Firebase
        await remove(ref(db, `users/${uid}/exams/${examId}`));
        await remove(ref(db, `users/${uid}/sessions/${examId}`));
        await remove(ref(db, `users/${uid}/exam_pdfs/${examId}`));
    }
}

export async function saveSession(uid, examId, data) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');

    const isLocal = readLocalExams(uid).some(e => String(e.id) === String(examId));

    const id = String(Date.now());
    const session = { id, date: new Date().toISOString(), ...data };

    if (isLocal) {
        const key = sessionsKey(uid, examId);
        const raw = localStorage.getItem(key);
        const obj = raw ? JSON.parse(raw) : {};
        obj[session.id] = session;
        localStorage.setItem(key, JSON.stringify(obj));
    } else {
        const newSessionRef = push(ref(db, `users/${uid}/sessions/${examId}`));
        await set(newSessionRef, session);
        session.id = newSessionRef.key;
    }

    return session;
}

export async function loadSessions(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');

    const isLocal = readLocalExams(uid).some(e => String(e.id) === String(examId));

    let localSessions = [];
    if (isLocal) {
        const raw = localStorage.getItem(sessionsKey(uid, examId));
        if (raw) {
            const obj = JSON.parse(raw);
            localSessions = Object.entries(obj).map(([id, s]) => ({ id, ...s, isLocal: true }));
        }
    }

    let fbSessions = [];
    if (!isLocal) {
        try {
            const snapshot = await get(ref(db, `users/${uid}/sessions/${examId}`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                fbSessions = Object.keys(data).map(key => ({ id: key, ...data[key], isLocal: false }));
            }
        } catch (err) {
            console.error("Error fetching sessions from Firebase:", err);
        }
    }

    const combined = [...localSessions, ...fbSessions];
    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return combined;
}

export async function deleteSession(uid, examId, sessionId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    ensureArg(sessionId, 'sessionId');

    const isLocal = readLocalExams(uid).some(e => String(e.id) === String(examId));

    if (isLocal) {
        const key = sessionsKey(uid, examId);
        const raw = localStorage.getItem(key);
        if (raw) {
            const obj = JSON.parse(raw);
            delete obj[sessionId];
            localStorage.setItem(key, JSON.stringify(obj));
        }
    } else {
        await remove(ref(db, `users/${uid}/sessions/${examId}/${sessionId}`));
    }
}

export async function clearHistory(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');

    const isLocal = readLocalExams(uid).some(e => String(e.id) === String(examId));
    if (isLocal) {
        localStorage.removeItem(sessionsKey(uid, examId));
    } else {
        await remove(ref(db, `users/${uid}/sessions/${examId}`));
    }
}

export async function deleteAllExams(uid) {
    ensureArg(uid, 'uid');
    const exams = readLocalExams(uid);
    for (const e of exams) {
        try { localStorage.removeItem(sessionsKey(uid, e.id)); } catch (_) { }
    }
    localStorage.removeItem(examsKey(uid));
}

export async function savePdfToExam(uid, examId, pdfName, base64) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');

    const isLocal = readLocalExams(uid).some(e => String(e.id) === String(examId));
    if (isLocal) {
        console.warn("Saving PDF to local exam might exceed localStorage quota.");
        return null;
    }

    const newPdfRef = push(ref(db, `users/${uid}/exam_pdfs/${examId}`));
    const pdfData = { name: pdfName, value: base64, createdAt: Date.now() };
    await set(newPdfRef, pdfData);

    return { id: newPdfRef.key, ...pdfData };
}

export async function loadPdfsForExam(uid, examId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');

    const isLocal = readLocalExams(uid).some(e => String(e.id) === String(examId));
    if (isLocal) return [];

    let pdfs = [];
    try {
        let snapshot = await get(ref(db, `users/${uid}/exam_pdfs/${examId}`));
        
        if (!snapshot.exists()) {
            snapshot = await get(ref(db, `users/${uid}/exams/${examId}/pdfs`));
        }

        if (snapshot.exists()) {
            const data = snapshot.val();
            pdfs = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        }
    } catch (err) {
        console.error("Error fetching pdfs from Firebase:", err);
    }
    return pdfs;
}

export async function removePdfFromExam(uid, examId, pdfId) {
    ensureArg(uid, 'uid');
    ensureArg(examId, 'examId');
    ensureArg(pdfId, 'pdfId');

    const isLocal = readLocalExams(uid).some(e => String(e.id) === String(examId));
    if (isLocal) return;

    await remove(ref(db, `users/${uid}/exam_pdfs/${examId}/${pdfId}`));
    await remove(ref(db, `users/${uid}/exams/${examId}/pdfs/${pdfId}`));
}
