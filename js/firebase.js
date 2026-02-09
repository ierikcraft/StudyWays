import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, get, child, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCkXt3TyOj9dUQiYmgMJVeJ-gRomohlgKU",
    authDomain: "studyways-8c49b.firebaseapp.com",
    databaseURL: "https://studyways-8c49b-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "studyways-8c49b",
    storageBucket: "studyways-8c49b.firebasestorage.app",
    messagingSenderId: "104037873199",
    appId: "1:104037873199:web:1029e5a62f21adc8eaf8da",
    measurementId: "G-DG99FYENSD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export async function getUserNotebooks(userId) {
    if (!userId) return [];
    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `users/${userId}/notebooks`));
        if (snapshot.exists()) {
            const data = snapshot.val();
            // Convert object to array
            return Object.values(data).map(nb => ({ ...nb, source: 'cloud' }));
        } else {
            return [];
        }
    } catch (error) {
        console.error("Error getting cloud notebooks:", error);
        return [];
    }
}

export async function saveNotebookToCloud(userId, notebook) {
    if (!userId || !notebook) return;
    try {
        const notebookRef = ref(db, `users/${userId}/notebooks/${notebook.id}`);
        // Ensure source is set to cloud before saving
        const dataToSave = { ...notebook, source: 'cloud' };
        await set(notebookRef, dataToSave);
        return dataToSave;
    } catch (error) {
        console.error("Error saving notebook to cloud:", error);
        throw error;
    }
}

export async function deleteNotebookFromCloud(userId, notebookId) {
    if (!userId || !notebookId) return;
    try {
        const notebookRef = ref(db, `users/${userId}/notebooks/${notebookId}`);
        await remove(notebookRef);
    } catch (error) {
        console.error("Error deleting notebook from cloud:", error);
        throw error;
    }
}
