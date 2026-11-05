import * as api from './api.js?v=13';
import * as storage from './storage.js?v=13';
import * as ui from './ui.js?v=13';
import * as auth from './auth.js?v=13';
import * as pdfUtils from './pdf_utils.js?v=13';

let flashcardCount = 5;
let chatHistory = [];
let currentContext = '';
let currentUser = null;
let currentExam = null;
let loadedPDFs = []; // Array to store loaded PDFs


function initSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;

    let hidden = false;
    const hide = () => {
        if (hidden) return;
        hidden = true;
        splash.classList.add('fade-out');
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    };

    setTimeout(hide, 800);
}

// Trigger dismissal timer immediately
initSplashScreen();


const uploadProgress = {
    overlay: null,
    barFill: null,
    percentText: null,
    fractionText: null,
    titleText: null,
    fileNameText: null,
    tipText: null,
    iconEl: null,
    tipInterval: null,
    iconInterval: null,
    tips: [
        "Analizando apuntes con visión e inteligencia artificial...",
        "Extrayendo texto y fórmulas de tus fotos...",
        "Reconociendo caligrafía y ordenando párrafos...",
        "Tip: Podrás generar flashcards y tests automáticos.",
        "Tip: El audio resumen lee tus lecciones con voz interactiva.",
        "Casi listo, afinando los últimos detalles...",
        "Preparando tu texto para estudiar a tope 🚀"
    ],
    icons: ["📄", "📸", "🔍", "🧠", "⚡", "✨"],

    init() {
        this.overlay = document.getElementById('upload-progress-overlay');
        this.barFill = document.getElementById('upload-bar-fill');
        this.percentText = document.getElementById('upload-progress-percent');
        this.fractionText = document.getElementById('upload-progress-fraction');
        this.titleText = document.getElementById('upload-progress-title');
        this.fileNameText = document.getElementById('upload-file-name');
        this.tipText = document.getElementById('upload-tip-text');
        this.iconEl = document.getElementById('upload-anim-icon');
    },

    start(totalFiles) {
        if (!this.overlay) this.init();
        if (!this.overlay) return;

        this.titleText.textContent = totalFiles === 1 
            ? "Subiendo y analizando archivo..." 
            : `Subiendo ${totalFiles} archivos...`;
        this.fileNameText.textContent = "Iniciando análisis...";
        this.barFill.style.width = '6%';
        this.barFill.style.background = '';
        this.percentText.textContent = '6%';
        this.fractionText.textContent = `0 / ${totalFiles}`;
        this.iconEl.textContent = '📄';

        let tipIdx = 0;
        this.tipText.textContent = this.tips[0];
        clearInterval(this.tipInterval);
        this.tipInterval = setInterval(() => {
            tipIdx = (tipIdx + 1) % this.tips.length;
            this.tipText.style.opacity = '0';
            this.tipText.style.transform = 'translateY(4px)';
            setTimeout(() => {
                this.tipText.textContent = this.tips[tipIdx];
                this.tipText.style.opacity = '1';
                this.tipText.style.transform = 'translateY(0)';
            }, 250);
        }, 3000);

        let iconIdx = 0;
        clearInterval(this.iconInterval);
        this.iconInterval = setInterval(() => {
            iconIdx = (iconIdx + 1) % this.icons.length;
            this.iconEl.textContent = this.icons[iconIdx];
        }, 1200);

        this.overlay.classList.remove('hidden');
    },

    setFileInProcess(fileName, currentIdx, totalFiles) {
        if (!this.overlay) return;
        this.fileNameText.textContent = `Procesando: ${fileName}`;
        const basePercent = Math.max(6, Math.round((currentIdx / totalFiles) * 100));
        this.barFill.style.width = `${basePercent}%`;
        this.percentText.textContent = `${basePercent}%`;
        this.fractionText.textContent = `${currentIdx} / ${totalFiles}`;
    },

    update(doneCount, totalFiles) {
        if (!this.overlay) return;
        const percent = Math.min(100, Math.max(6, Math.round((doneCount / totalFiles) * 100)));
        this.barFill.style.width = `${percent}%`;
        this.percentText.textContent = `${percent}%`;
        this.fractionText.textContent = `${doneCount} / ${totalFiles}`;
    },

    async finish(totalFiles, successCount) {
        if (!this.overlay) return;
        clearInterval(this.tipInterval);
        clearInterval(this.iconInterval);

        this.barFill.style.width = '100%';
        this.percentText.textContent = '100%';
        this.fractionText.textContent = `${totalFiles} / ${totalFiles}`;
        this.iconEl.textContent = '✅';
        this.barFill.style.background = 'linear-gradient(90deg, #10b981, #059669)';
        this.titleText.textContent = successCount === 1 
            ? "¡Archivo procesado con éxito!" 
            : `¡${successCount} archivos listos para estudiar!`;
        this.fileNameText.textContent = "Extracción completada";
        this.tipText.textContent = "✨ Apuntes cargados. ¡Ya puedes crear resúmenes o tests!";

        await new Promise(r => setTimeout(r, 850));
        this.overlay.classList.add('hidden');
    }
};

function initApp() {
    initSplashScreen();
    // ErikAI Welcome popup
    const urlParams = new URLSearchParams(window.location.search);
    const erikaiParam = urlParams.get('erikai');
    if (erikaiParam && erikaiParam.toLowerCase() === 'true' && !localStorage.getItem('erikai_welcome_shown')) {
        setTimeout(() => {
            showCustomAlert("ErikAI ha mejorado la forma de estudiar:\n\n✅ Crea resúmenes de audio\n✅ Crea flash cards\ny mucho más...", "✨");
            localStorage.setItem('erikai_welcome_shown', 'true');
        }, 500);
    }

    // Check Auth
    let user = auth.getUser();
    if (!user) {
        user = auth.handleAuthCallback();
    }

    if (user) {
        currentUser = user;
        showApp(user);
    } else {
        showLanding();
    }

    // Auth Actions
    document.getElementById('btn-login').addEventListener('click', auth.login);
    document.getElementById('btn-logout').addEventListener('click', auth.logout);
    const dashLogout = document.getElementById('dash-btn-logout');
    if (dashLogout) dashLogout.addEventListener('click', auth.logout);

    // Main Actions
    ui.elements.actionSummary.addEventListener('click', handleSummary);
    ui.elements.actionAudioSummary.addEventListener('click', handleAudioSummary);
    ui.elements.actionFlashcards.addEventListener('click', handleFlashcards);
    ui.elements.actionTest.addEventListener('click', handleTest);
    ui.elements.actionChat.addEventListener('click', initializeChat);
    document.getElementById('input-text').addEventListener('input', updateCharCount);

    // PDF Upload
    const btnClearAllPdfs = document.getElementById('btn-clear-all-pdfs');
    if (btnClearAllPdfs) {
        btnClearAllPdfs.addEventListener('click', clearAllLoadedPDFs);
    }

    const btnUpload = document.getElementById('btn-upload-pdf');
    const fileInput = document.getElementById('pdf-upload');

    btnUpload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        fileInput.value = '';
        if (files.length === 0) return;

        let done = 0;
        uploadProgress.start(files.length);

        const processFile = async (file, index) => {
            uploadProgress.setFileInProcess(file.name, done, files.length);
            try {
                let base64;
                let text;
                if (pdfUtils.isImageFile(file)) {
                    const imageDataUrl = await pdfUtils.imageFileToDataUrl(file);
                    text = await api.imageToText(imageDataUrl);
                    if (!text.trim()) throw new Error('no se detectó texto');
                    base64 = pdfUtils.textToDataUrl(text);
                } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
                    base64 = await pdfUtils.fileToBase64(file);
                    text = await pdfUtils.extractTextFromPDF(file);
                    if (!text.trim()) throw new Error('el PDF no contiene texto seleccionable');
                } else {
                    throw new Error('formato no soportado');
                }

                let id = Date.now() + Math.random();
                if (currentExam && !currentExam.isLocal) {
                    try {
                        const result = await storage.savePdfToExam(currentUser.id, currentExam.id, file.name, base64);
                        if (result) id = result.id;
                    } catch (err) {
                        console.error('Cloud save failed for file', file.name, err);
                    }
                }
                return { ok: true, name: file.name, text, id };
            } catch (err) {
                console.error('Error procesando', file.name, err);
                return { ok: false, name: file.name, error: err.message || String(err) };
            } finally {
                done++;
                uploadProgress.update(done, files.length);
            }
        };

        try {
            const results = await runWithConcurrency(files, 3, processFile);

            const successResults = results.filter(r => r.ok);
            successResults.forEach(r => addPDFToList(r.name, r.text, r.id));

            await uploadProgress.finish(files.length, successResults.length);

            const failed = results.filter(r => !r.ok);
            if (failed.length) {
                showCustomAlert(
                    `No se pudieron leer ${failed.length} de ${files.length} archivo(s):

` +
                    failed.map(r => `• ${r.name}: ${r.error}`).join('\n'),
                    '⚠️'
                );
            }
        } catch (err) {
            console.error('Error in batch file upload:', err);
            await uploadProgress.finish(files.length, 0);
        }
    });

    // Settings Modal
    ui.elements.actionSettings.addEventListener('click', openSettings);
    ui.elements.closeModal.addEventListener('click', closeSettings);
    ui.elements.saveSettings.addEventListener('click', saveSettings);
    ui.elements.flashcardCountInput.addEventListener('input', (e) => {
        ui.elements.flashcardCountInfo.textContent = e.target.value;
    });

    // Test-count modal handlers
    if (ui.elements.testCountStartBtn) {
        ui.elements.testCountStartBtn.addEventListener('click', async () => {
            const raw = ui.elements.testCountInput.value;
            const count = parseInt(raw, 10);
            if (!Number.isInteger(count) || count < 1) {
                return showCustomAlert('Introduce un número válido de al menos 1 pregunta.');
            }
            if (count > 50) {
                return showCustomAlert('Por motivos de seguridad, el límite máximo es de 50 preguntas por test.');
            }
            ui.elements.testCountModal.classList.add('hidden');

            // proceed with generating the test (same logic as previous inline flow)
            const text = ui.elements.inputArea.value.trim();
            if (!text) return showCustomAlert('Por favor ingresa un texto para generar el test.');
            if (!currentExam) return showCustomAlert('Selecciona o crea un examen antes de guardar.');

            ui.toggleLoading(true);
            try {
                const questions = await api.generateTest(text, count);
                // Shuffle questions and shuffle options inside each question
                shuffleArray(questions);
                questions.forEach(q => shuffleArray(q.options));

                ui.elements.contentTitle.textContent = `Test — ${count} preguntas`;

                ui.renderTest(questions, async (result) => {
                    // Save test session (include user's answers + meta.count)
                    await storage.saveSession(currentUser.id, currentExam.id, {
                        type: 'test',
                        content: { questions: result.questions, userAnswers: result.userAnswers || [], score: result.score, correctCount: result.correctCount },
                        originalText: text,
                        meta: { count }
                    });
                    await loadHistory();
                }, {
                    onExpertAdvice: (qs, answers, container, btn) => handleExpertAdvice(text, qs, answers, container, btn)
                });
            } catch (err) {
                console.error(err);
                alert('Error generando test: ' + err.message);
            } finally {
                ui.toggleLoading(false);
            }
        });
        ui.elements.testCountCancelBtn.addEventListener('click', () => ui.elements.testCountModal.classList.add('hidden'));
        ui.elements.testCountCloseBtn.addEventListener('click', () => ui.elements.testCountModal.classList.add('hidden'));
    }

    // Exams: create/select
    ui.elements.btnCreateExam.addEventListener('click', openCreateExamModal);
    ui.elements.closeCreateExam.addEventListener('click', closeCreateExamModal);
    ui.elements.cancelExamBtn.addEventListener('click', closeCreateExamModal);
    ui.elements.saveExamBtn.addEventListener('click', saveNewExam);

    // Notebook dashboard: create button (if present on the landing dashboard)
    const btnCreateNotebook = document.getElementById('btn-create-notebook');
    if (btnCreateNotebook) btnCreateNotebook.addEventListener('click', openCreateExamModal);

    // Back to dashboard from app
    const btnBack = document.getElementById('btn-back-dashboard');
    if (btnBack) btnBack.addEventListener('click', showNotebookDashboard);

    const btnTopBack = document.getElementById('btn-top-back');
    if (btnTopBack) btnTopBack.addEventListener('click', showNotebookDashboard);

    // Mobile Bottom Navigation
    const navHistory = document.getElementById('nav-btn-history');
    const navSources = document.getElementById('nav-btn-sources');
    const navGenerate = document.getElementById('nav-btn-generate');
    const navTest = document.getElementById('nav-btn-test');

    if (navHistory) navHistory.addEventListener('click', () => switchMobileTab('history'));
    if (navSources) navSources.addEventListener('click', () => switchMobileTab('sources'));
    if (navGenerate) navGenerate.addEventListener('click', () => switchMobileTab('generate'));
    if (navTest) navTest.addEventListener('click', () => switchMobileTab('test'));

    // Mobile Generator Tools
    const mBtnSummary = document.getElementById('m-btn-summary');
    const mBtnAudio = document.getElementById('m-btn-audio');
    const mBtnFlashcards = document.getElementById('m-btn-flashcards');
    const mBtnFlashcardsSettings = document.getElementById('m-btn-flashcards-settings');
    const mBtnTest = document.getElementById('m-btn-test');
    const mBtnChat = document.getElementById('m-btn-chat');
    const mBtnToGenerate = document.getElementById('m-btn-to-generate');
    const mBtnGoSources = document.getElementById('m-btn-go-sources');

    if (mBtnSummary) mBtnSummary.addEventListener('click', handleSummary);
    if (mBtnAudio) mBtnAudio.addEventListener('click', handleAudioSummary);
    if (mBtnFlashcards) mBtnFlashcards.addEventListener('click', handleFlashcards);
    if (mBtnFlashcardsSettings) mBtnFlashcardsSettings.addEventListener('click', openSettings);
    if (mBtnTest) mBtnTest.addEventListener('click', handleTest);
    if (mBtnChat) mBtnChat.addEventListener('click', initializeChat);
    if (mBtnToGenerate) mBtnToGenerate.addEventListener('click', () => switchMobileTab('generate'));

    // Generar toolbar buttons
    const btnSummaryGen = document.getElementById('btn-summary-gen');
    const btnAudioGen = document.getElementById('btn-audio-summary-gen');
    const btnFlashcardsGen = document.getElementById('btn-flashcards-gen');
    const btnFlashcardsSettingsGen = document.getElementById('btn-flashcards-settings-gen');
    const btnChatGen = document.getElementById('btn-chat-gen');
    const btnTestGen = document.getElementById('btn-test-gen');

    if (btnSummaryGen) btnSummaryGen.addEventListener('click', handleSummary);
    if (btnAudioGen) btnAudioGen.addEventListener('click', handleAudioSummary);
    if (btnFlashcardsGen) btnFlashcardsGen.addEventListener('click', handleFlashcards);
    if (btnFlashcardsSettingsGen) btnFlashcardsSettingsGen.addEventListener('click', openSettings);
    if (btnChatGen) btnChatGen.addEventListener('click', initializeChat);
    if (btnTestGen) btnTestGen.addEventListener('click', handleTest);
    if (mBtnGoSources) mBtnGoSources.addEventListener('click', () => switchMobileTab('sources'));

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target === ui.elements.modal) closeSettings();
        if (e.target === ui.elements.createExamModal) closeCreateExamModal();
        if (e.target === ui.elements.testCountModal) ui.elements.testCountModal.classList.add('hidden');
    });

    // showApp already handles showing the notebook dashboard if the user is logged in.
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}


async function refreshExamsList() {
    const exams = await storage.listExams(currentUser.id);
    updateActiveExamIndicator(currentExam);
    ui.updateExamsList(exams,
        async (action, examId) => {
            if (action === 'delete') {
                await storage.deleteExam(currentUser.id, examId);
                if (currentExam && currentExam.id === examId) currentExam = null;
                await refreshExamsList();
                if (!currentExam) {
                    const remaining = await storage.listExams(currentUser.id);
                    if (remaining.length) selectExam(remaining[0]);
                }
                await loadHistory();
            }
        },
        (exam) => selectExam(exam)
    );
    ui.markExamSelected(currentExam ? currentExam.id : null);
}

async function selectExam(exam) {
    currentExam = exam;
    ui.markExamSelected(exam.id);
    updateActiveExamIndicator(exam);
    switchMobileTab('sources');
    loadHistory();
    
    loadedPDFs = [];
    ui.elements.inputArea.value = '';
    updatePDFListUI();
    ui.elements.inputArea.dispatchEvent(new Event('input'));
    
    if (exam && !exam.isLocal) {
        ui.toggleLoading(true);
        try {
            const pdfs = await storage.loadPdfsForExam(currentUser.id, exam.id);
            for (let p of pdfs) {
                let text;
                if (typeof p.value === 'string' && p.value.startsWith('data:text/plain')) {
                    // Texto extraído de una foto
                    text = pdfUtils.dataUrlToText(p.value);
                } else {
                    const blob = pdfUtils.base64ToBlob(p.value, 'application/pdf');
                    const file = new File([blob], p.name, { type: 'application/pdf' });
                    text = await pdfUtils.extractTextFromPDF(file);
                }
                addPDFToList(p.name, text, p.id);
            }
        } catch (err) {
            console.error("Error loading PDFs for exam", err);
        } finally {
            ui.toggleLoading(false);
        }
    }
}

function openCreateExamModal() {
    ui.elements.createExamModal.classList.remove('hidden');
    ui.elements.examEmojiInput.value = '';
    ui.elements.examTitleInput.value = '';
    ui.elements.examEmojiInput.focus();
}

function closeCreateExamModal() {
    ui.elements.createExamModal.classList.add('hidden');
}

async function saveNewExam() {
    if (!currentUser) return alert('Debes iniciar sesión para crear un examen.');
    const emoji = ui.elements.examEmojiInput.value.trim() || '📘';
    const title = ui.elements.examTitleInput.value.trim() || 'Nuevo examen';
    const exam = await storage.createExam(currentUser.id, { emoji, title });
    closeCreateExamModal();
    await refreshExamsList();
    selectExam(exam);
    // Open the study panel after creating/selecting
    showAppContainer();
}


function switchMobileTab(tab) {
    const container = document.getElementById('app-container');
    if (!container) return;
    
    // Normalize tab: 'sources' | 'generate' | 'history'
    if (tab === 'test') tab = 'generate';
    
    container.classList.remove('mobile-tab-history', 'mobile-tab-sources', 'mobile-tab-generate', 'mobile-tab-test');
    container.classList.add(`mobile-tab-${tab}`);
    
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    const tabLabels = {
        'sources': '📄 Fuentes',
        'generate': '✨ Generar',
        'history': '📚 Historial'
    };
    const indicator = document.getElementById('active-tab-indicator');
    if (indicator) {
        indicator.textContent = tabLabels[tab] || '📄 Fuentes';
    }
}

function updateActiveExamIndicator(exam) {
    const iconEl = document.getElementById('active-exam-icon');
    const titleEl = document.getElementById('active-exam-title');
    if (exam) {
        if (iconEl) iconEl.textContent = exam.emoji || '📘';
        if (titleEl) titleEl.textContent = exam.title || 'Libreta sin nombre';
    } else {
        if (iconEl) iconEl.textContent = '📁';
        if (titleEl) titleEl.textContent = 'Sin libreta seleccionada';
    }
}

function showApp(user) {
    // After login, show the notebook dashboard (prototype) instead of opening app directly
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('notebook-dashboard').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');

    document.getElementById('user-name').textContent = user.name;
    document.getElementById('dash-user-name').textContent = user.name;
    // Optional: Set avatar if available or initials
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();

    // render dashboard
    renderNotebooksDashboard();

    // delete-all button handler (local-only storage)
    const delAllBtn = document.getElementById('btn-delete-all');
    if (delAllBtn) {
        delAllBtn.addEventListener('click', async () => {
            if (!currentUser) return alert('Debes iniciar sesión');
            const ok = confirm('Eliminar todas las libretas y su historial (local)?');
            if (!ok) return;
            await storage.deleteAllExams(currentUser.id);
            await refreshExamsList();
            renderNotebooksDashboard();
            alert('Todas las libretas han sido eliminadas (local).');
        });
    }
}

function showLanding() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('notebook-dashboard').classList.add('hidden');
}

function showNotebookDashboard() {
    // show dashboard (used from Back button)
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('notebook-dashboard').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    if (currentUser) document.getElementById('dash-user-name').textContent = currentUser.name;
    renderNotebooksDashboard();
}

function showAppContainer() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('notebook-dashboard').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    switchMobileTab('sources');
    updateActiveExamIndicator(currentExam);
}

async function renderNotebooksDashboard() {
    if (!currentUser) return;

    try {
        const exams = await storage.listExams(currentUser.id);
        const grid = document.getElementById('notebooks-grid');
        grid.querySelectorAll('.notebook-card.item').forEach(n => n.remove());
        exams.forEach(exam => {
            const card = document.createElement('div');
            card.className = 'notebook-card item';
            card.dataset.id = exam.id;
            card.innerHTML = `
                <div style="font-size:1.2rem; margin-right:0.5rem;">${exam.emoji || '📘'}</div>
                <div style="display:flex; flex-direction:column;">
                    <strong>${exam.title}</strong>
                    <small style="color:var(--text-muted);">Creado: ${new Date(exam.createdAt || Date.now()).toLocaleDateString()}</small>
                </div>
            `;
            card.addEventListener('click', async () => {
                // switch to app and select exam
                selectExam(exam);
                await refreshExamsList();
                showAppContainer();
            });
            // insert before the "new" card
            const newCard = document.getElementById('btn-create-notebook');
            grid.insertBefore(card, newCard);
        });
    } catch (err) {
        console.error('Error rendering notebooks dashboard', err);
    }
}


function updateCharCount(e) {
    const count = e.target.value.length;
    document.getElementById('char-count').textContent = `${count} caracteres`;
}

// --- Test Logic ---
async function handleTest() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return showCustomAlert('Por favor ingresa un texto para generar el test.');
    if (!currentExam) return showCustomAlert('Selecciona o crea un examen antes de guardar.');

    // show modal to pick number of questions (replaces prompt())
    const defaultCount = Number(ui.elements.flashcardCountInput.value) || 5;
    ui.elements.testCountInput.value = String(defaultCount);
    ui.elements.testCountModal.classList.remove('hidden');
    ui.elements.testCountInput.focus();
}


function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}


// --- Settings Logic ---
function openSettings() {
    ui.elements.modal.classList.remove('hidden');
}

function closeSettings() {
    ui.elements.modal.classList.add('hidden');
}

function saveSettings() {
    flashcardCount = ui.elements.flashcardCountInput.value;
    const mCountLabel = document.getElementById('m-flashcards-count-label');
    if (mCountLabel) mCountLabel.textContent = `${flashcardCount} tarjetas`;
    closeSettings();
}

// --- Feature Logic ---

async function handleSummary() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto.');
    if (!currentExam) return alert('Selecciona o crea un examen antes de guardar.');

    switchMobileTab('generate');
    ui.toggleLoading(true);
    try {
        const summary = await api.generateSummary(text);
        ui.renderSummary(summary);

        await storage.saveSession(currentUser.id, currentExam.id, {
            type: 'summary',
            content: summary,
            originalText: text
        });
        await loadHistory();
    } catch (error) {
        alert('Error al generar resumen: ' + error.message);
    } finally {
        ui.toggleLoading(false);
    }
}

async function handleAudioSummary() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto.');
    if (!currentExam) return alert('Selecciona o crea un examen antes de guardar.');

    switchMobileTab('generate');
    ui.toggleLoading(true);
    try {
        const audioSummary = await api.generateAudioSummary(text);
        ui.renderAudioSummary(audioSummary);

        await storage.saveSession(currentUser.id, currentExam.id, {
            type: 'audio-summary',
            content: audioSummary,
            originalText: text
        });
        await loadHistory();
    } catch (error) {
        alert('Error al generar resumen de audio: ' + error.message);
    } finally {
        ui.toggleLoading(false);
    }
}

async function handleFlashcards() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto.');
    if (!currentExam) return alert('Selecciona o crea un examen antes de guardar.');

    switchMobileTab('generate');
    ui.toggleLoading(true);
    try {
        const cards = await api.generateFlashcards(text, flashcardCount);
        ui.renderFlashcards(cards, (card) => explainFlashcard(text, card));

        await storage.saveSession(currentUser.id, currentExam.id, {
            type: 'flashcard',
            content: cards,
            originalText: text,
            meta: { count: flashcardCount }
        });
        await loadHistory();
    } catch (error) {
        alert('Error al generar flashcards: ' + error.message);
    } finally {
        ui.toggleLoading(false);
    }
}

function explainFlashcard(text, card) {
    currentContext = text;
    chatHistory = [];
    ui.renderChatInterface(handleChatMessage);
    
    // Automatically send a question about the flashcard
    const question = `Explica me esta pregunta y respuesta:\n\nPregunta: ${card.question}\n\nRespuesta: ${card.answer}`;
    
    // Send the message after a small delay to ensure UI is ready
    setTimeout(() => {
        handleChatMessage(question);
    }, 100);
}

function initializeChat() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return alert('Por favor ingresa un texto para chatear sobre él.');

    switchMobileTab('generate');
    currentContext = text;
    chatHistory = []; // Reset history on new chat start
    ui.renderChatInterface(handleChatMessage);
}

async function handleChatMessage(message) {
    if (!message) return;

    ui.appendChatMessage('user', message);

    try {
        const response = await api.chatWithContext(currentContext, message, chatHistory);
        ui.appendChatMessage('ai', response);

        chatHistory.push({ role: 'user', content: message });
        chatHistory.push({ role: 'assistant', content: response });
    } catch (error) {
        ui.appendChatMessage('ai', 'Error: ' + error.message);
        console.error(error);
    }
}


async function loadHistory() {
    if (!currentUser || !currentExam) {
        ui.updateHistoryList([], () => {}, () => {});
        return;
    }

    const history = await storage.loadSessions(currentUser.id, currentExam.id);
    ui.updateHistoryList(
        history,
        async (id) => {
            await storage.deleteSession(currentUser.id, currentExam.id, id);
            await loadHistory();
        },
        (session) => {
            switchMobileTab('generate');
            ui.elements.inputArea.value = session.originalText;
            if (session.type === 'summary') {
                ui.renderSummary(session.content);
            } else if (session.type === 'audio-summary') {
                ui.renderAudioSummary(session.content);
            } else if (session.type === 'flashcard') {
                ui.renderFlashcards(session.content, (card) => explainFlashcard(session.originalText || ui.elements.inputArea.value, card));
            } else if (session.type === 'test') {
                // show test in read-only review mode (allows "Volver a hacer" to start interactive)
                const questions = session.content.questions || [];
                if (!questions.length) return alert('No hay preguntas guardadas para esta sesión.');
                const userAnswers = session.content.userAnswers || null;
                ui.renderTest(questions, async (result) => {
                    // if user repeats the test and finishes, save new session
                    await storage.saveSession(currentUser.id, currentExam.id, {
                        type: 'test',
                        content: { questions: result.questions, userAnswers: result.userAnswers || [], score: result.score, correctCount: result.correctCount },
                        originalText: session.originalText || ui.elements.inputArea.value,
                        meta: { count: result.total }
                    });
                    await loadHistory();
                }, { 
                    readOnly: true, 
                    userAnswers,
                    onExpertAdvice: (qs, answers, container, btn) => handleExpertAdvice(session.originalText || ui.elements.inputArea.value, qs, answers, container, btn)
                });
            } else if (session.type === 'chat') {
                // Restore chat if implemented
            }
        }
    );
}

// PDF Management Functions
// Ejecuta tareas en paralelo con un límite, devolviendo los resultados en el orden original
async function runWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await worker(items[i], i);
        }
    });
    await Promise.all(runners);
    return results;
}

function addPDFToList(filename, textContent, providedId) {
    const id = providedId || (Date.now() + Math.random());
    if (!loadedPDFs.find(p => p.id === id)) {
        loadedPDFs.push({
            id,
            name: filename,
            text: textContent
        });
        updatePDFListUI();
        updateTextAreaFromPDFs();
    }
}

async function removePDFFromList(id) {
    loadedPDFs = loadedPDFs.filter(pdf => String(pdf.id) !== String(id));
    updatePDFListUI();
    updateTextAreaFromPDFs();
    
    if (currentUser && currentExam && !currentExam.isLocal) {
        try {
            await storage.removePdfFromExam(currentUser.id, currentExam.id, id);
        } catch (err) {
            console.error("Failed to remove PDF from cloud", err);
        }
    }
}

function updateTextAreaFromPDFs() {
    // Junta el texto de todos los PDFs y fotos, con el nombre de cada archivo como cabecera
    const combinedText = loadedPDFs
        .map(file => `=== ${file.name} ===\n\n${(file.text || '').trim()}`)
        .join('\n\n');
    ui.elements.inputArea.value = combinedText;
    ui.elements.inputArea.dispatchEvent(new Event('input'));
}

async function clearAllLoadedPDFs() {
    if (loadedPDFs.length === 0) return;
    const idsToRemove = loadedPDFs.map(p => p.id);
    loadedPDFs = [];
    updatePDFListUI();
    updateTextAreaFromPDFs();
    
    if (currentUser && currentExam && !currentExam.isLocal) {
        for (const id of idsToRemove) {
            try {
                await storage.removePdfFromExam(currentUser.id, currentExam.id, id);
            } catch (err) {
                console.error("Failed to remove PDF from cloud", err);
            }
        }
    }
}

function updatePDFListUI() {
    const container = document.getElementById('pdfs-container');
    const list = document.getElementById('pdfs-list');
    const countEl = document.getElementById('pdfs-count');
    const clearBtn = document.getElementById('btn-clear-all-pdfs');
    
    if (loadedPDFs.length === 0) {
        container.style.display = 'none';
        if (list) list.innerHTML = '';
        return;
    }
    
    container.style.display = 'flex';
    if (countEl) countEl.textContent = loadedPDFs.length;
    if (clearBtn) clearBtn.style.display = loadedPDFs.length > 1 ? 'block' : 'none';
    
    list.innerHTML = loadedPDFs.map(pdf => `
        <div class="pdf-item">
            <span class="pdf-item-name" title="${escapeHtml(pdf.name)}">
                <span class="pdf-item-icon">${/\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(pdf.name) ? '🖼️' : '📄'}</span>
                <span class="pdf-item-text">${escapeHtml(pdf.name)}</span>
            </span>
            <button class="btn-remove-pdf" data-pdf-id="${pdf.id}" type="button" title="Eliminar archivo">✕</button>
        </div>
    `).join('');
    
    // Add event listeners to delete buttons
    list.querySelectorAll('.btn-remove-pdf').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const btnEl = e.target.closest('.btn-remove-pdf');
            const pdfId = btnEl.getAttribute('data-pdf-id');
            removePDFFromList(pdfId);
        });
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showCustomAlert(message, customIcon = '🛡️') {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '99999';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';

    const box = document.createElement('div');
    box.style.backgroundColor = 'var(--background-color, #ffffff)';
    box.style.padding = '2rem';
    box.style.borderRadius = 'var(--radius-md, 12px)';
    box.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
    box.style.maxWidth = '400px';
    box.style.width = '90%';
    box.style.textAlign = 'center';
    box.style.transform = 'translateY(-20px)';
    box.style.transition = 'transform 0.3s ease';

    const icon = document.createElement('div');
    icon.innerHTML = customIcon;
    icon.style.fontSize = '3rem';
    icon.style.marginBottom = '1rem';

    const text = document.createElement('p');
    text.textContent = message;
    text.style.fontSize = '1.1rem';
    text.style.color = 'var(--text-color, #333)';
    text.style.marginBottom = '1.5rem';
    text.style.lineHeight = '1.5';
    text.style.whiteSpace = 'pre-wrap';

    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = 'Entendido';
    btn.style.width = '100%';
    btn.style.marginTop = '1rem';
    
    btn.addEventListener('click', () => {
        overlay.style.opacity = '0';
        box.style.transform = 'translateY(-20px)';
        setTimeout(() => overlay.remove(), 300);
    });

    box.appendChild(icon);
    box.appendChild(text);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Trigger animation next frame
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });
}

async function handleExpertAdvice(text, qs, answers, container, btn) {
    if (!text) return showCustomAlert('No hay texto original para aconsejar.');
    
    // Filter incorrect answers
    const incorrect = qs.map((q, i) => {
        const a = answers[i];
        if (!a || !a.correct) {
            return {
                question: q.question,
                userAnswer: a ? q.options[a.selected].text : 'No respondida',
                correctAnswer: q.options.find(o => o.correct)?.text
            };
        }
        return null;
    }).filter(Boolean);

    if (incorrect.length === 0) {
        return showCustomAlert('¡Has acertado todas! No necesitas consejos, ¡sigue así!');
    }

    btn.disabled = true;
    btn.innerHTML = '⏳ Entendiendo tus fallos...';

    try {
        const advice = await api.getExpertAdvice(text, incorrect);
        
        const div = document.createElement('div');
        div.className = 'advice-content fade-in';
        div.style.marginTop = '2rem';
        div.style.padding = '1.5rem';
        div.style.backgroundColor = 'var(--background-color)';
        div.style.borderRadius = 'var(--radius-md)';
        div.style.borderLeft = '4px solid #8b5cf6';
        div.innerHTML = `<h3 style="color: #8b5cf6; margin-top: 0; display: flex; align-items: center; gap: 0.5rem;"><span>💡</span> Consejo del Experto</h3><div class="markdown-body" style="font-size: 0.95rem; line-height: 1.6;">${marked.parse(advice)}</div>`;
        
        container.appendChild(div);
        
        // Use requestAnimationFrame to let DOM update before scrolling
        requestAnimationFrame(() => {
             container.scrollTop = container.scrollHeight;
        });
        btn.style.display = 'none'; // hide button once clicked
    } catch (err) {
        console.error(err);
        showCustomAlert('Error obteniendo consejo: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = '💡 Consejo del Experto';
    }
}
