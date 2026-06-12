import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  where 
} from "firebase/firestore";

// Firebase Configuration with user provided credentials as fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCoOQGZqZFdA82V2EDIa07hXbmMW1ugQoo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-856395995-d843d.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "studio-856395995-d843d",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-856395995-d843d.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "106909967902",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:106909967902:web:d4716b6b7ee575b5b6700f"
};

// Check if a valid config is provided (at least projectId is required)
const isFirebaseConfigured = firebaseConfig.projectId && firebaseConfig.apiKey;

let app;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log("Firebase initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
  }
} else {
  console.warn("Firebase config is missing. App will run in LocalStorage fallback mode.");
}

export { db, isFirebaseConfigured };
