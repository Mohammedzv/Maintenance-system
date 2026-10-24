// إعداد Firebase: ضع بيانات مشروعك من Firebase Console هنا.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDmJ4mrcgpWx0KeFsNalc0bFIT3bmOmF_c",
  authDomain: "sstmy-627dc.firebaseapp.com",
  projectId: "sstmy-627dc",
  storageBucket: "sstmy-627dc.firebasestorage.app",
  messagingSenderId: "711278472895",
  appId: "1:711278472895:web:3f8ecd2eb8946bbbcae00a",
  measurementId: "G-B38ZQ6N0GL"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);