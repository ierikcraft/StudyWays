import * as api from './api.js?v=17';
import * as storage from './storage.js?v=17';
import * as ui from './ui.js?v=17';
import * as auth from './auth.js?v=17';
import * as pdfUtils from './pdf_utils.js?v=17';

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
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        fileInput.value = '';
        handleFilesUpload(files);
    });

    // Drag and Drop support
    const inputSection = document.querySelector('.input-section');
    if (inputSection) {
        ['dragenter', 'dragover'].forEach(evt => {
            inputSection.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                inputSection.classList.add('drag-active');
            });
        });
        ['dragleave', 'drop'].forEach(evt => {
            inputSection.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                inputSection.classList.remove('drag-active');
            });
        });
        inputSection.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleFilesUpload(Array.from(dt.files));
            }
        });
    }

    // User Account Menu & Storage
    const dashUserBtn = document.getElementById('dash-user-btn');
    if (dashUserBtn) {
        dashUserBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserMenu(dashUserBtn);
        });
    }

    const appUserBtn = document.getElementById('app-user-btn');
    if (appUserBtn) {
        appUserBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserMenu(appUserBtn);
        });
    }

    const menuBtnStorage = document.getElementById('menu-btn-storage');
    if (menuBtnStorage) {
        menuBtnStorage.addEventListener('click', (e) => {
            e.stopPropagation();
            openStorageModal();
        });
    }

    const menuBtnForcedTest = document.getElementById('menu-btn-forced-test');
    if (menuBtnForcedTest) {
        menuBtnForcedTest.addEventListener('click', (e) => {
            e.stopPropagation();
            closeUserMenu();
            openForcedTestPicker();
        });
    }

    const closeFtPicker = document.getElementById('close-ft-picker');
    if (closeFtPicker) closeFtPicker.addEventListener('click', closeForcedTestPicker);

    const closeFtBriefing = document.getElementById('close-ft-briefing');
    if (closeFtBriefing) closeFtBriefing.addEventListener('click', closeForcedTestBriefing);

    const cancelFtBriefing = document.getElementById('ft-cancel-briefing');
    if (cancelFtBriefing) cancelFtBriefing.addEventListener('click', closeForcedTestBriefing);

    const startCountdownBtn = document.getElementById('ft-start-countdown-btn');
    if (startCountdownBtn) startCountdownBtn.addEventListener('click', startForcedTestCountdown);

    const ftUnlockBtn = document.getElementById('ft-btn-unlock');
    if (ftUnlockBtn) ftUnlockBtn.addEventListener('click', finishAndUnlockForcedTest);

    // Target selector buttons in briefing
    const ftOpt10 = document.getElementById('ft-opt-10');
    const ftOpt12 = document.getElementById('ft-opt-12');
    if (ftOpt10 && ftOpt12) {
        ftOpt10.addEventListener('click', () => selectForcedTestTarget(10));
        ftOpt12.addEventListener('click', () => selectForcedTestTarget(12));
    }

    const menuBtnLogout = document.getElementById('menu-btn-logout');
    if (menuBtnLogout) {
        menuBtnLogout.addEventListener('click', (e) => {
            e.stopPropagation();
            closeUserMenu();
            auth.logout();
        });
    }

    const closeStorageBtn = document.getElementById('close-storage-modal');
    if (closeStorageBtn) closeStorageBtn.addEventListener('click', closeStorageModal);

    const btnStorageClose = document.getElementById('btn-storage-close');
    if (btnStorageClose) btnStorageClose.addEventListener('click', closeStorageModal);

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

    if (navHistory) navHistory.addEventListener('click', () => switchMobileTab('history'));
    if (navSources) navSources.addEventListener('click', () => switchMobileTab('sources'));
    if (navGenerate) navGenerate.addEventListener('click', () => switchMobileTab('generate'));

    // Modal Enter key shortcuts
    if (ui.elements.examTitleInput) {
        ui.elements.examTitleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveNewExam();
            }
        });
    }
    if (ui.elements.examEmojiInput) {
        ui.elements.examEmojiInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                ui.elements.examTitleInput.focus();
            }
        });
    }
    if (ui.elements.testCountInput) {
        ui.elements.testCountInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (ui.elements.testCountStartBtn) ui.elements.testCountStartBtn.click();
            }
        });
    }

    // Global Escape key shortcut
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSettings();
            closeCreateExamModal();
            if (ui.elements.testCountModal) ui.elements.testCountModal.classList.add('hidden');
        }
    });

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

    // Close modal & menus on outside click
    window.addEventListener('click', (e) => {
        if (e.target === ui.elements.modal) closeSettings();
        if (e.target === ui.elements.createExamModal) closeCreateExamModal();
        if (e.target === ui.elements.testCountModal) ui.elements.testCountModal.classList.add('hidden');
        if (e.target === document.getElementById('storage-modal')) closeStorageModal();

        // Close user dropdown if click was outside
        const menu = document.getElementById('user-menu-dropdown');
        if (menu && !menu.classList.contains('hidden')) {
            const isClickInside = menu.contains(e.target) ||
                (dashUserBtn && dashUserBtn.contains(e.target)) ||
                (appUserBtn && appUserBtn.contains(e.target));
            if (!isClickInside) {
                closeUserMenu();
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeUserMenu();
            closeStorageModal();
            closeForcedTestPicker();
            closeForcedTestBriefing();
        }

        // Keyboard navigation for Forced Test (1, 2, 3, 4 or Enter)
        if (activeForcedTest && activeForcedTest.status === 'in_progress') {
            const feedbackBox = document.getElementById('ft-feedback-box');
            const isFeedbackVisible = feedbackBox && !feedbackBox.classList.contains('hidden');

            if (isFeedbackVisible && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                const nextBtn = document.getElementById('ft-next-btn');
                if (nextBtn) nextBtn.click();
                return;
            }

            if (!isFeedbackVisible && ['1', '2', '3', '4'].includes(e.key)) {
                const optIndex = parseInt(e.key, 10) - 1;
                const optionsContainer = document.getElementById('ft-options-list');
                if (optionsContainer && optionsContainer.children[optIndex]) {
                    const btn = optionsContainer.children[optIndex];
                    if (!btn.disabled) btn.click();
                }
            }
        }
    });

    
    window.addEventListener('beforeunload', (e) => {
        if (activeForcedTest && activeForcedTest.status === 'in_progress') {
            activeForcedTest.isLiveSession = false;
            activeForcedTest.lastUpdatedAt = Date.now();
            try {
                localStorage.setItem(`studyways_forced_test_${currentUser.id}`, JSON.stringify(activeForcedTest));
            } catch (err) {}
            e.preventDefault();
            e.returnValue = '¡Estás en el Test Obligado! Si sales serás penalizado con más preguntas.';
            return e.returnValue;
        }
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
    if (exam && exam.id) {
        ui.markExamSelected(exam.id);
    }
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
    if (!currentUser) return showCustomAlert('Debes iniciar sesión para crear un examen.', '🔒');
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

async function showApp(user) {
    // After login, show the notebook dashboard (prototype) instead of opening app directly
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('notebook-dashboard').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');

    document.getElementById('user-name').textContent = user.name;
    document.getElementById('dash-user-name').textContent = user.name;
    const initial = user.name.charAt(0).toUpperCase();
    document.getElementById('user-avatar').textContent = initial;
    const dashAvatar = document.getElementById('dash-user-avatar');
    if (dashAvatar) dashAvatar.textContent = initial;

    // Check if active forced test lockdown exists
    const hasLockdown = await checkForcedTestLockdown();
    if (hasLockdown) return;

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
    if (activeForcedTest && activeForcedTest.status === 'in_progress') {
        const overlay = document.getElementById('forced-test-overlay');
        if (overlay) overlay.classList.remove('hidden');
        return;
    }
    // Stop active audio synthesis when returning to dashboard
    if ('speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('notebook-dashboard').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
    if (currentUser) {
        document.getElementById('dash-user-name').textContent = currentUser.name;
        const dashAvatar = document.getElementById('dash-user-avatar');
        if (dashAvatar) dashAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
    }
    renderNotebooksDashboard();
}

function showAppContainer() {
    if (activeForcedTest && activeForcedTest.status === 'in_progress') {
        const overlay = document.getElementById('forced-test-overlay');
        if (overlay) overlay.classList.remove('hidden');
        return;
    }
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

        // Aviso toast si se superan los 40 examenes/libretas al entrar al menu principal
        if (exams && exams.length > 40) {
            showStorageWarningToast(exams.length);
        }
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
    if (!text) return showCustomAlert('Por favor ingresa apuntes o un texto para comenzar.', '📝');
    if (!currentExam) return showCustomAlert('Selecciona o crea un cuaderno antes de guardar.', '📘');

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
        showCustomAlert('Error al generar resumen: ' + error.message, '⚠️');
    } finally {
        ui.toggleLoading(false);
    }
}

async function handleAudioSummary() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return showCustomAlert('Por favor ingresa apuntes o un texto para comenzar.', '📝');
    if (!currentExam) return showCustomAlert('Selecciona o crea un cuaderno antes de guardar.', '📘');

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
        showCustomAlert('Error al generar resumen de audio: ' + error.message, '⚠️');
    } finally {
        ui.toggleLoading(false);
    }
}

async function handleFlashcards() {
    const text = ui.elements.inputArea.value.trim();
    if (!text) return showCustomAlert('Por favor ingresa apuntes o un texto para comenzar.', '📝');
    if (!currentExam) return showCustomAlert('Selecciona o crea un cuaderno antes de guardar.', '📘');

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
        showCustomAlert('Error al generar flashcards: ' + error.message, '⚠️');
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
    if (!text) return showCustomAlert('Por favor ingresa o carga un texto para chatear sobre él.', '💬');

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

async function handleFilesUpload(files) {
    if (!files || files.length === 0) return;

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
                if (!text || !text.trim()) throw new Error('no se detectó texto');
                base64 = pdfUtils.textToDataUrl(text);
            } else if (pdfUtils.isPdfFile(file)) {
                base64 = await pdfUtils.fileToBase64(file);
                text = await pdfUtils.extractTextFromPDF(file);
                if (!text || !text.trim()) throw new Error('el PDF no contiene texto seleccionable');
            } else {
                throw new Error('formato no soportado (sube PDF o imágenes)');
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
                `No se pudieron leer ${failed.length} de ${files.length} archivo(s):\n\n` +
                failed.map(r => `• ${r.name}: ${r.error}`).join('\n'),
                '⚠️'
            );
        }
    } catch (err) {
        console.error('Error in batch file upload:', err);
        await uploadProgress.finish(files.length, 0);
    }
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
    
    const closeAlert = () => {
        overlay.style.opacity = '0';
        box.style.transform = 'translateY(-20px)';
        document.removeEventListener('keydown', keyHandler);
        setTimeout(() => overlay.remove(), 300);
    };

    const keyHandler = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
            e.preventDefault();
            closeAlert();
        }
    };

    btn.addEventListener('click', closeAlert);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAlert();
    });
    document.addEventListener('keydown', keyHandler);

    box.appendChild(icon);
    box.appendChild(text);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Trigger animation next frame and focus button
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'translateY(0)';
        btn.focus();
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

/* ==========================================================================
   User Account Menu, ErikCloud Storage & Warning Toast
   ========================================================================== */
function toggleUserMenu(triggerEl) {
    const menu = document.getElementById('user-menu-dropdown');
    if (!menu) return;

    if (!menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
        return;
    }

    if (currentUser) {
        const menuName = document.getElementById('menu-user-name');
        const menuAvatar = document.getElementById('menu-user-avatar');
        if (menuName) menuName.textContent = currentUser.name || 'Usuario';
        if (menuAvatar) menuAvatar.textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
    }

    updateStorageInfo();

    const rect = triggerEl.getBoundingClientRect();
    const menuWidth = 260;
    menu.style.top = (rect.bottom + 8) + 'px';

    const rightSpace = window.innerWidth - rect.right;
    if (rightSpace >= 10 && rect.right - menuWidth >= 10) {
        menu.style.right = rightSpace + 'px';
        menu.style.left = 'auto';
    } else {
        const left = Math.max(10, Math.min(window.innerWidth - menuWidth - 10, rect.left));
        menu.style.left = left + 'px';
        menu.style.right = 'auto';
    }

    menu.classList.remove('hidden');
}

function closeUserMenu() {
    const menu = document.getElementById('user-menu-dropdown');
    if (menu) menu.classList.add('hidden');
}

async function openStorageModal() {
    closeUserMenu();
    await updateStorageInfo();
    const modal = document.getElementById('storage-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeStorageModal() {
    const modal = document.getElementById('storage-modal');
    if (modal) modal.classList.add('hidden');
}

async function updateStorageInfo() {
    if (!currentUser) return;
    try {
        const exams = await storage.listExams(currentUser.id);
        const count = exams ? exams.length : 0;
        const max = 500;
        const percent = Math.min(100, Math.round((count / max) * 100));

        // Subtitulo en el menu desplegable
        const menuPreview = document.getElementById('menu-storage-preview');
        if (menuPreview) {
            menuPreview.textContent = count + ' / ' + max + ' exámenes usados';
        }

        // Metricas en la modal
        const meterMetric = document.getElementById('storage-meter-metric');
        if (meterMetric) {
            meterMetric.textContent = count + ' / ' + max + ' exámenes (' + percent + '%)';
        }

        const percentLabel = document.getElementById('storage-meter-percent-label');
        if (percentLabel) {
            percentLabel.textContent = percent + '% ocupado';
        }

        const meterFill = document.getElementById('storage-meter-fill');
        if (meterFill) {
            const fillWidth = count > 0 ? Math.max(3, percent) : 0;
            meterFill.style.width = fillWidth + '%';
            if (count > 40) {
                meterFill.classList.add('warning-gradient');
            } else {
                meterFill.classList.remove('warning-gradient');
            }
        }

        const statUsed = document.getElementById('storage-stat-used');
        if (statUsed) statUsed.textContent = count;

        const statFree = document.getElementById('storage-stat-free');
        if (statFree) statFree.textContent = Math.max(0, max - count);

        const warningCard = document.getElementById('storage-warning-card');
        if (warningCard) {
            if (count > 40) {
                warningCard.classList.remove('hidden');
            } else {
                warningCard.classList.add('hidden');
            }
        }
    } catch (err) {
        console.error('Error updating storage metrics:', err);
    }
}

let activeToastTimeout = null;

function showStorageWarningToast(count) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Eliminar toast previo si ya estuviese visible
    const existing = document.getElementById('storage-warning-toast');
    if (existing) {
        if (activeToastTimeout) clearTimeout(activeToastTimeout);
        existing.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast-card warning-toast';
    toast.id = 'storage-warning-toast';
    toast.innerHTML = `
        <div class="toast-header-row">
            <span class="toast-badge">⚠️ Aviso de espacio</span>
            <button class="toast-close-btn" type="button" title="Cerrar">×</button>
        </div>
        <div class="toast-body">
            <div class="toast-icon-wrap">⚠️</div>
            <div class="toast-text-wrap">
                <h4 class="toast-title">Se recomienda borrar algunas libretas</h4>
                <p class="toast-desc">Tienes <strong>${count} libretas</strong> guardadas en ErikCloud (superas las 40 recomendadas). Se recomienda eliminar las que ya no uses para mantener tu espacio de estudio rápido y organizado.</p>
            </div>
        </div>
        <div class="toast-footer">
            <button class="toast-action-btn" type="button">Ver almacenamiento</button>
        </div>
        <div class="toast-timer-bar">
            <div class="toast-timer-fill"></div>
        </div>
    `;

    toast.querySelector('.toast-close-btn').addEventListener('click', () => {
        dismissToast(toast);
    });

    toast.querySelector('.toast-action-btn').addEventListener('click', () => {
        dismissToast(toast);
        openStorageModal();
    });

    container.appendChild(toast);

    // Desaparece automaticamente tras 5 segundos
    activeToastTimeout = setTimeout(() => {
        dismissToast(toast);
    }, 5000);
}

function dismissToast(toast) {
    if (!toast || toast.classList.contains('toast-hiding')) return;
    toast.classList.add('toast-hiding');
    setTimeout(() => {
        if (toast && toast.parentElement) toast.remove();
    }, 320);
}

/* ==========================================================================
   MODO TEST OBLIGADO — HARD STUDYING
   ========================================================================== */
let activeForcedTest = null;
let selectedForcedTestExam = null;
let selectedForcedTestTarget = 10;
let currentQuestionStep = null;

// --- Web Audio Synthesizer (Zero External Dependencies) ---
function playBeep(freq = 440, type = 'sine', duration = 0.15) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {}
}

function playDing() {
    playBeep(523.25, 'triangle', 0.12);
    setTimeout(() => playBeep(659.25, 'triangle', 0.18), 110);
}

function playBuzz() {
    playBeep(220, 'sawtooth', 0.28);
}

function playTriumph() {
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        setTimeout(() => playBeep(freq, 'triangle', 0.28), i * 110);
    });
}

// --- Step 1: Picker Modal ---
async function openForcedTestPicker() {
    if (!currentUser) return showCustomAlert('Debes iniciar sesión para usar el modo Hard Studying.', '🔒');

    const modal = document.getElementById('forced-test-picker-modal');
    const list = document.getElementById('ft-exams-list');
    if (!modal || !list) return;

    list.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">Cargando libretas...</div>';
    modal.classList.remove('hidden');

    try {
        const exams = await storage.listExams(currentUser.id);
        list.innerHTML = '';

        if (!exams || exams.length === 0) {
            list.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No tienes libretas creadas. Crea una primero para ponerte a prueba.</div>';
            return;
        }

        for (const exam of exams) {
            // Check if exam has PDFs or content
            let pdfCount = 0;
            try {
                const pdfs = await storage.loadPdfsForExam(currentUser.id, exam.id);
                pdfCount = pdfs ? pdfs.length : 0;
            } catch (e) {}

            const item = document.createElement('div');
            item.className = 'ft-exam-pick-item' + (pdfCount === 0 ? ' disabled' : '');
            item.innerHTML = `
                <div class="ft-exam-pick-emoji">${exam.emoji || '📘'}</div>
                <div class="ft-exam-pick-info">
                    <strong class="ft-exam-pick-title">${exam.title}</strong>
                    <span class="ft-exam-pick-status">${pdfCount > 0 ? `📄 ${pdfCount} archivo(s) detectado(s)` : '⚠️ Sin documentos subidos'}</span>
                </div>
                <span class="ft-exam-pick-arrow">›</span>
            `;

            item.addEventListener('click', () => {
                if (pdfCount === 0) {
                    showCustomAlert('Esta libreta no tiene documentos PDF o fotos subidas. Sube apuntes a esta libreta primero para poder evaluarte con ella.', '⚠️');
                    return;
                }
                openForcedTestBriefing(exam, pdfCount);
            });

            list.appendChild(item);
        }
    } catch (err) {
        console.error('Error listing exams for forced test:', err);
        list.innerHTML = '<div style="padding: 1rem; color: #ef4444;">Error al cargar las libretas.</div>';
    }
}

function closeForcedTestPicker() {
    const modal = document.getElementById('forced-test-picker-modal');
    if (modal) modal.classList.add('hidden');
}

// --- Step 2: Briefing Modal ---
function openForcedTestBriefing(exam, pdfCount) {
    closeForcedTestPicker();
    selectedForcedTestExam = exam;
    selectedForcedTestTarget = 10;

    const modal = document.getElementById('forced-test-briefing-modal');
    if (!modal) return;

    document.getElementById('ft-briefing-emoji').textContent = exam.emoji || '📘';
    document.getElementById('ft-briefing-title').textContent = exam.title;
    document.getElementById('ft-briefing-source-info').textContent = `📄 ${pdfCount} archivo(s) listo(s) para generar el test`;

    selectForcedTestTarget(10);
    modal.classList.remove('hidden');
}

function closeForcedTestBriefing() {
    const modal = document.getElementById('forced-test-briefing-modal');
    if (modal) modal.classList.add('hidden');
}

function selectForcedTestTarget(target) {
    selectedForcedTestTarget = target;
    const opt10 = document.getElementById('ft-opt-10');
    const opt12 = document.getElementById('ft-opt-12');
    if (opt10 && opt12) {
        opt10.classList.toggle('active', target === 10);
        opt12.classList.toggle('active', target === 12);
    }
}

// --- Step 3: Countdown (3... 2... 1... ¡A ESTUDIAR!) ---
function startForcedTestCountdown() {
    closeForcedTestBriefing();
    const overlay = document.getElementById('forced-test-countdown-overlay');
    const numEl = document.getElementById('countdown-number');
    if (!overlay || !numEl) return;

    overlay.classList.remove('hidden');

    let count = 3;
    numEl.textContent = '3';
    numEl.classList.remove('go-text');
    playBeep(440, 'sine', 0.2);

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            numEl.textContent = String(count);
            numEl.classList.remove('go-text');
            numEl.style.animation = 'none';
            void numEl.offsetWidth; // re-trigger animation
            numEl.style.animation = 'count-pop 1s cubic-bezier(0.16, 1, 0.3, 1)';
            playBeep(440, 'sine', 0.2);
        } else if (count === 0) {
            numEl.textContent = '¡A ESTUDIAR!';
            numEl.classList.add('go-text');
            numEl.style.animation = 'none';
            void numEl.offsetWidth;
            numEl.style.animation = 'count-pop 1s cubic-bezier(0.16, 1, 0.3, 1)';
            playBeep(659.25, 'triangle', 0.3);
            setTimeout(() => playBeep(880, 'triangle', 0.4), 90);
        } else {
            clearInterval(timer);
            overlay.classList.add('hidden');
            initiateForcedTest(selectedForcedTestExam, selectedForcedTestTarget);
        }
    }, 950);
}

// --- Step 4: Full Content Extractor ---
async function getExamFullContent(uid, examId) {
    let combinedText = '';
    try {
        const pdfs = await storage.loadPdfsForExam(uid, examId);
        if (pdfs && pdfs.length > 0) {
            for (let p of pdfs) {
                let text = '';
                if (typeof p.value === 'string' && p.value.startsWith('data:text/plain')) {
                    text = pdfUtils.dataUrlToText(p.value);
                } else if (p.value) {
                    const blob = pdfUtils.base64ToBlob(p.value, 'application/pdf');
                    const file = new File([blob], p.name || 'doc.pdf', { type: 'application/pdf' });
                    text = await pdfUtils.extractTextFromPDF(file);
                }
                if (text) {
                    combinedText += `\n\n=== ${p.name || 'Archivo'} ===\n${text}`;
                }
            }
        }
    } catch (e) {
        console.error('Error fetching PDFs for exam text:', e);
    }

    try {
        const sessions = await storage.loadSessions(uid, examId);
        if (sessions && sessions.length > 0) {
            sessions.forEach(s => {
                if (s.originalText && !combinedText.includes(s.originalText.slice(0, 50))) {
                    combinedText += `\n\n${s.originalText}`;
                }
            });
        }
    } catch (e) {}

    return combinedText.trim();
}

// --- Step 5: Initiate Forced Test & Cloud Save ---
async function initiateForcedTest(exam, target) {
    const overlay = document.getElementById('forced-test-overlay');
    const loadingCard = document.getElementById('ft-loading-card');
    const questionCard = document.getElementById('ft-question-card');
    const victoryCard = document.getElementById('ft-victory-card');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    if (loadingCard) loadingCard.classList.remove('hidden');
    if (questionCard) questionCard.classList.add('hidden');
    if (victoryCard) victoryCard.classList.add('hidden');

    document.getElementById('ft-exam-tag').textContent = `${exam.emoji || '📘'} ${exam.title}`;

    try {
        const examText = await getExamFullContent(currentUser.id, exam.id);
        const sourceText = examText && examText.length > 50 ? examText : `Libreta: ${exam.title}. Contenido temático de estudio.`;

        // Request questions from AI (minimum 10)
        const questionsCount = Math.max(10, target + 2);
        let questions = await api.generateTest(sourceText, questionsCount);

        if (!questions || questions.length === 0) {
            throw new Error('No se pudieron obtener preguntas del contenido.');
        }

        // Shuffle options in each question
        questions.forEach(q => shuffleArray(q.options));
        shuffleArray(questions);

        activeForcedTest = {
            examId: exam.id,
            examTitle: exam.title,
            examEmoji: exam.emoji || '📘',
            targetCorrect: target,
            currentCorrect: 0,
            totalAnswered: 0,
            streak: 0,
            maxStreak: 0,
            penaltiesCount: 0,
            status: 'in_progress',
            isLiveSession: true,
            startedAt: Date.now(),
            lastUpdatedAt: Date.now(),
            examTextSample: sourceText.slice(0, 4000),
            questionsPool: questions,
            currentQuestionIndex: 0,
            failedQuestions: []
        };

        // Save immediately to Cloud (Firebase) & LocalStorage
        await storage.saveForcedTest(currentUser.id, activeForcedTest);

        renderForcedTestQuestion();
    } catch (err) {
        console.error('Error starting forced test:', err);
        showCustomAlert('Hubo un error al generar las preguntas del examen: ' + err.message, '⚠️');
        overlay.classList.add('hidden');
    }
}

// --- Step 6: Render Current Question & Options ---
function renderForcedTestQuestion() {
    if (!activeForcedTest) return;

    const overlay = document.getElementById('forced-test-overlay');
    const loadingCard = document.getElementById('ft-loading-card');
    const questionCard = document.getElementById('ft-question-card');
    const victoryCard = document.getElementById('ft-victory-card');

    if (overlay) overlay.classList.remove('hidden');
    if (loadingCard) loadingCard.classList.add('hidden');
    if (victoryCard) victoryCard.classList.add('hidden');
    if (questionCard) questionCard.classList.remove('hidden');

    // Header updates
    document.getElementById('ft-exam-tag').textContent = `${activeForcedTest.examEmoji || '📘'} ${activeForcedTest.examTitle}`;

    // Penalty indicators
    const penaltyPill = document.getElementById('ft-penalty-pill');
    const penaltyBanner = document.getElementById('ft-penalty-banner');
    if (activeForcedTest.penaltiesCount > 0) {
        if (penaltyPill) {
            penaltyPill.classList.remove('hidden');
            document.getElementById('ft-penalty-text').textContent = `+${activeForcedTest.penaltiesCount * 2} preguntas por abandono`;
        }
        if (penaltyBanner) {
            penaltyBanner.classList.remove('hidden');
            document.getElementById('ft-penalty-banner-desc').innerHTML = `Saliste o recargaste durante el Test Obligado. Se han añadido <strong>+${activeForcedTest.penaltiesCount * 2} preguntas</strong> a tu meta. ¡Termina el test para desbloquear la app!`;
        }
    } else {
        if (penaltyPill) penaltyPill.classList.add('hidden');
        if (penaltyBanner) penaltyBanner.classList.add('hidden');
    }

    // Progress updates
    const ratioText = `${activeForcedTest.currentCorrect} / ${activeForcedTest.targetCorrect}`;
    document.getElementById('ft-progress-ratio').textContent = ratioText;
    document.getElementById('ft-streak-count').textContent = activeForcedTest.streak || 0;

    const percent = Math.min(100, Math.round((activeForcedTest.currentCorrect / activeForcedTest.targetCorrect) * 100));
    document.getElementById('ft-bar-fill').style.width = `${percent}%`;

    // Check if goal reached
    if (activeForcedTest.currentCorrect >= activeForcedTest.targetCorrect) {
        showForcedTestVictory();
        return;
    }

    // Get next question
    let pool = activeForcedTest.questionsPool || [];
    let idx = activeForcedTest.currentQuestionIndex || 0;

    if (idx >= pool.length) {
        // Recycle failed questions if available
        if (activeForcedTest.failedQuestions && activeForcedTest.failedQuestions.length > 0) {
            pool = [...activeForcedTest.failedQuestions];
            shuffleArray(pool);
            activeForcedTest.questionsPool = pool;
            activeForcedTest.failedQuestions = [];
            activeForcedTest.currentQuestionIndex = 0;
            idx = 0;
        } else {
            // Need more questions: fetch batch in background
            generateMoreQuestionsForTest();
            return;
        }
    }

    const currentQ = pool[idx];
    if (!currentQ) return;
    currentQuestionStep = currentQ;

    document.getElementById('ft-q-num').textContent = `Pregunta ${(activeForcedTest.totalAnswered || 0) + 1}`;
    document.getElementById('ft-q-text').textContent = currentQ.question;

    // Feedback box hide
    const feedbackBox = document.getElementById('ft-feedback-box');
    if (feedbackBox) {
        feedbackBox.classList.add('hidden');
        feedbackBox.classList.remove('is-correct', 'is-incorrect');
    }

    // Render options
    const optionsContainer = document.getElementById('ft-options-list');
    optionsContainer.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];
    currentQ.options.forEach((opt, oIndex) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ft-opt-btn';
        btn.innerHTML = `
            <span class="ft-opt-letter">${letters[oIndex] || String(oIndex + 1)}</span>
            <span class="ft-opt-text">${opt.text}</span>
        `;

        btn.addEventListener('click', () => handleForcedTestAnswer(opt, btn, optionsContainer));
        optionsContainer.appendChild(btn);
    });
}

// --- Step 7: Evaluate Answer ---
async function handleForcedTestAnswer(chosenOpt, chosenBtn, container) {
    if (!activeForcedTest || !currentQuestionStep) return;

    // Disable all options immediately
    Array.from(container.children).forEach(btn => btn.disabled = true);

    const isCorrect = !!chosenOpt.correct;
    activeForcedTest.totalAnswered = (activeForcedTest.totalAnswered || 0) + 1;

    // Highlight options
    if (isCorrect) {
        chosenBtn.classList.add('correct');
        activeForcedTest.currentCorrect = (activeForcedTest.currentCorrect || 0) + 1;
        activeForcedTest.streak = (activeForcedTest.streak || 0) + 1;
        activeForcedTest.maxStreak = Math.max(activeForcedTest.maxStreak || 0, activeForcedTest.streak);
        playDing();
    } else {
        chosenBtn.classList.add('incorrect');
        activeForcedTest.streak = 0;
        // Find correct button to highlight green
        Array.from(container.children).forEach((btn, bi) => {
            if (currentQuestionStep.options[bi] && currentQuestionStep.options[bi].correct) {
                btn.classList.add('correct');
            }
        });
        // Push to failed questions so it repeats!
        if (!activeForcedTest.failedQuestions) activeForcedTest.failedQuestions = [];
        activeForcedTest.failedQuestions.push(currentQuestionStep);
        playBuzz();
    }

    // Show feedback banner
    const feedbackBox = document.getElementById('ft-feedback-box');
    const feedbackIcon = document.getElementById('ft-feedback-icon');
    const feedbackTitle = document.getElementById('ft-feedback-title');
    const feedbackMsg = document.getElementById('ft-feedback-msg');
    const nextBtn = document.getElementById('ft-next-btn');

    if (feedbackBox) {
        feedbackBox.classList.remove('hidden', 'is-correct', 'is-incorrect');
        feedbackBox.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');

        if (isCorrect) {
            if (feedbackIcon) feedbackIcon.textContent = '✅';
            if (feedbackTitle) feedbackTitle.textContent = '¡Correcto!';
            if (feedbackMsg) feedbackMsg.textContent = `Excelente trabajo. Sumas +1 a tu meta (${activeForcedTest.currentCorrect}/${activeForcedTest.targetCorrect}).`;
        } else {
            const correctOpt = currentQuestionStep.options.find(o => o.correct);
            if (feedbackIcon) feedbackIcon.textContent = '❌';
            if (feedbackTitle) feedbackTitle.textContent = 'Respuesta incorrecta';
            if (feedbackMsg) feedbackMsg.textContent = `La opción correcta era: "${correctOpt ? correctOpt.text : ''}". Esta pregunta volverá a salir hasta que la aciertes.`;
        }

        if (nextBtn) {
            nextBtn.onclick = () => {
                activeForcedTest.currentQuestionIndex = (activeForcedTest.currentQuestionIndex || 0) + 1;
                renderForcedTestQuestion();
            };
        }
    }

    // Sync progress to cloud & local storage
    activeForcedTest.lastUpdatedAt = Date.now();
    await storage.saveForcedTest(currentUser.id, activeForcedTest);
}

// --- Step 8: Generate More Questions if Exhausted ---
async function generateMoreQuestionsForTest() {
    const loadingCard = document.getElementById('ft-loading-card');
    const questionCard = document.getElementById('ft-question-card');

    if (loadingCard) loadingCard.classList.remove('hidden');
    if (questionCard) questionCard.classList.add('hidden');

    try {
        const text = activeForcedTest.examTextSample || 'Apuntes y conceptos clave de la libreta.';
        const moreQs = await api.generateTest(text, 6);
        if (moreQs && moreQs.length > 0) {
            moreQs.forEach(q => shuffleArray(q.options));
            shuffleArray(moreQs);
            activeForcedTest.questionsPool = moreQs;
            activeForcedTest.currentQuestionIndex = 0;
            await storage.saveForcedTest(currentUser.id, activeForcedTest);
            renderForcedTestQuestion();
            return;
        }
    } catch (e) {
        console.error('Error fetching more questions in forced test:', e);
    }

    // If API failed or text exhausted, repeat from existing pool
    if (activeForcedTest.questionsPool && activeForcedTest.questionsPool.length > 0) {
        shuffleArray(activeForcedTest.questionsPool);
        activeForcedTest.currentQuestionIndex = 0;
        renderForcedTestQuestion();
    }
}

// --- Step 9: Victory Screen & Cloud Unlock ---
async function showForcedTestVictory() {
    activeForcedTest.status = 'completed';
    playTriumph();

    const loadingCard = document.getElementById('ft-loading-card');
    const questionCard = document.getElementById('ft-question-card');
    const victoryCard = document.getElementById('ft-victory-card');

    if (loadingCard) loadingCard.classList.add('hidden');
    if (questionCard) questionCard.classList.add('hidden');
    if (victoryCard) victoryCard.classList.remove('hidden');

    document.getElementById('ft-stat-target').textContent = activeForcedTest.targetCorrect;
    document.getElementById('ft-stat-total').textContent = activeForcedTest.totalAnswered || activeForcedTest.targetCorrect;
    document.getElementById('ft-stat-streak').textContent = activeForcedTest.maxStreak || activeForcedTest.currentCorrect;

    // Clear cloud lockdown so normal navigation is restored
    await storage.clearForcedTest(currentUser.id);
}

function finishAndUnlockForcedTest() {
    activeForcedTest = null;
    const overlay = document.getElementById('forced-test-overlay');
    if (overlay) overlay.classList.add('hidden');

    showCustomAlert('🎉 ¡Enhorabuena! Has completado el Test Obligado en modo Hard Studying.', '🏆');
    showNotebookDashboard();
}

// --- Step 10: App Startup Lockdown Check ---
async function checkForcedTestLockdown() {
    if (!currentUser) return false;

    try {
        const testState = await storage.loadForcedTest(currentUser.id);
        if (testState && testState.status === 'in_progress') {
            // Check if abandonment / reload occurred
            // If isLiveSession is false or last update is older than 4 seconds: penalize with +2 questions!
            const timeDiff = Date.now() - (testState.lastUpdatedAt || 0);
            if (testState.isLiveSession === false || timeDiff > 4000) {
                testState.penaltiesCount = (testState.penaltiesCount || 0) + 1;
                testState.targetCorrect = (testState.targetCorrect || 10) + 2;
                testState.streak = 0;
            }

            testState.isLiveSession = true;
            testState.lastUpdatedAt = Date.now();
            activeForcedTest = testState;
            await storage.saveForcedTest(currentUser.id, testState);

            // Render lockdown immediately
            renderForcedTestQuestion();
            return true;
        }
    } catch (e) {
        console.error('Error checking forced test lockdown on startup:', e);
    }
    return false;
}
