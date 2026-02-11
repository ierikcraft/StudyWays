// history.js - módulo para historial de accidentes (Firestore)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Firebase config (proporcionado)
const firebaseConfig = {
  apiKey: "AIzaSyBxtWjOUDVWypkY8aCDLSn9wkWIkkwQ6DQ",
  authDomain: "unclick-d848c.firebaseapp.com",
  databaseURL: "https://unclick-d848c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "unclick-d848c",
  storageBucket: "unclick-d848c.firebasestorage.app",
  messagingSenderId: "1019458134221",
  appId: "1:1019458134221:web:c8dfb44512121859160984",
  measurementId: "G-EFZB6KM995"
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (e) { /* analytics optional */ }
const db = getFirestore(app);

// Simple passcode for admin actions (cámbialo si quieres)
const ADMIN_CODE = '1234';

let isAdmin = false;
let editingId = null;

// DOM
const btnLogin = document.getElementById('btn-login');
const adminPanel = document.getElementById('admin-panel');
const accidentForm = document.getElementById('accident-form');
const btnSave = document.getElementById('btn-save');
const btnCancel = document.getElementById('btn-cancel-edit');
const listContainer = document.getElementById('accidents-list');

const fDate = document.getElementById('field-datetime');
const fStatus = document.getElementById('field-status');
const fSeverity = document.getElementById('field-severity');
const fInfo = document.getElementById('field-info');
const fReason = document.getElementById('field-reason');
const fEstimated = document.getElementById('field-estimated');

// Login flow
btnLogin.addEventListener('click', async ()=>{
  if(isAdmin){
    // logout
    isAdmin = false;
    adminPanel.style.display = 'none';
    btnLogin.textContent = 'Login';
    return;
  }
  const code = prompt('Introduce el código de acceso:');
  if(code === ADMIN_CODE){
    isAdmin = true;
    adminPanel.style.display = 'block';
    btnLogin.textContent = 'Logout';
  } else {
    alert('Código incorrecto');
  }
});

// Helper: clear form
function clearForm(){
  editingId = null;
  fDate.value = new Date().toISOString().slice(0,16);
  fStatus.value = 'abierto';
  fSeverity.value = 'baja';
  fInfo.value = '';
  fReason.value = '';
  fEstimated.value = '';
}

btnCancel.addEventListener('click', (e)=>{ e.preventDefault(); clearForm(); });

accidentForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!isAdmin){ alert('Debes iniciar sesión como admin'); return; }

  const data = {
    datetime: fDate.value || new Date().toISOString(),
    status: fStatus.value,
    severity: fSeverity.value,
    info: fInfo.value,
    reason: fReason.value,
    estimated: fEstimated.value,
    updatedAt: serverTimestamp()
  };

  try{
    if(editingId){
      const ref = doc(db, 'accidents', editingId);
      await updateDoc(ref, data);
    } else {
      const col = collection(db, 'accidents');
      await addDoc(col, { ...data, createdAt: serverTimestamp() });
    }
    clearForm();
  } catch(err){ console.error(err); alert('Error guardando: '+err.message); }
});

// Real-time list
const accidentsCol = collection(db, 'accidents');
const q = query(accidentsCol, orderBy('createdAt','desc'));
onSnapshot(q, (snapshot)=>{
  listContainer.innerHTML = '';
  if(snapshot.empty){ listContainer.innerHTML = '<p class="muted">No hay accidentes registrados.</p>'; return; }
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const id = docSnap.id;
    const item = document.createElement('div');
    item.className = 'accident-item';

    const dt = data.datetime ? new Date(data.datetime).toLocaleString() : (data.createdAt ? 'Reciente' : '—');
    item.innerHTML = `
      <div class="flex" style="justify-content:space-between">
        <div>
          <strong>${dt}</strong>
          <div class="muted">Estado: ${data.status || ''} · Gravedad: ${data.severity || ''}</div>
        </div>
        <div class="flex">
          <button data-id="${id}" class="btn small-btn btn-edit">Editar</button>
        </div>
      </div>
      <div style="margin-top:0.5rem">${(data.info||'')}</div>
      <div class="muted" style="margin-top:0.3rem">Motivo: ${data.reason||''} · Tiempo estimado: ${data.estimated||''}</div>
    `;

    const btnEdit = item.querySelector('.btn-edit');
    btnEdit.addEventListener('click', ()=>{
      if(!isAdmin){ alert('Debes iniciar sesión como admin para editar'); return; }
      // populate form
      editingId = id;
      fDate.value = data.datetime ? (new Date(data.datetime)).toISOString().slice(0,16) : '';
      fStatus.value = data.status || 'abierto';
      fSeverity.value = data.severity || 'baja';
      fInfo.value = data.info || '';
      fReason.value = data.reason || '';
      fEstimated.value = data.estimated || '';
      adminPanel.style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    listContainer.appendChild(item);
  });
}, (err)=>{ console.error('snapshot error',err); listContainer.innerHTML = '<p class="muted">Error cargando datos.</p>'; });

// init default form date
clearForm();
