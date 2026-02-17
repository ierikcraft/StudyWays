// Firebase initialization (Realtime Database)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };