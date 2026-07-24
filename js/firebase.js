import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcqAjn_p_pU1IuN64lTrt0Vffk5006omQ",
  authDomain: "soccer-tactical-board-625d7.firebaseapp.com",
  projectId: "soccer-tactical-board-625d7",
  storageBucket: "soccer-tactical-board-625d7.firebasestorage.app",
  messagingSenderId: "609062497125",
  appId: "1:609062497125:web:5c2b2a0873d696b47ecf8c"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
