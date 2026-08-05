// Import modern Firebase tools directly from Google
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1bkUvt6PkFhR83bnHAPABbkgWijMyKsI",
  authDomain: "cryptocall-32dbb.firebaseapp.com",
  projectId: "cryptocall-32dbb",
  storageBucket: "cryptocall-32dbb.firebasestorage.app",
  messagingSenderId: "469600735226",
  appId: "1:469600735226:web:87e33d0ff912e24acc9e43"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Connect to our own Node.js Signaling Server for calls
const socket = io();

// ==========================================
// 2. UI ELEMENTS
// ==========================================
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const myEmailDisplay = document.getElementById('my-email-display');
const myAvatar = document.getElementById('my-avatar');

// Call / Chat Elements
const chatItems = document.querySelectorAll('.chat-item');
const mobileBackBtn = document.getElementById('mobile-back-btn');
let currentUser = null;

// ==========================================
// 3. AUTHENTICATION LOGIC (Smart Login)
// ==========================================
loginBtn.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    
    if (!email || !password) return alert("Please enter email and password");
    
    loginBtn.innerText = "Connecting...";

    try {
        // Try to log them in first
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        // If the account doesn't exist, create a new one instantly!
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (createError) {
            alert("Error: " + createError.message);
            loginBtn.innerText = "Log In / Sign Up";
        }
    }
});

// Listen for Login/Logout events in real-time
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User just logged in!
        currentUser = user;
        
        // Update the UI with their email and a generated Avatar letter
        myEmailDisplay.innerText = user.email;
        myAvatar.innerText = user.email.charAt(0).toUpperCase();
        
        // Hide Login Screen, Show Main App Screen
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        
        // Tell our Node.js server we are online
        socket.emit('user-online', user.email);
    } else {
        // User is logged out
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
});


// ==========================================
// 4. MOBILE UI SWIPE LOGIC
// ==========================================
chatItems.forEach(item => {
    item.addEventListener('click', () => {
        appScreen.classList.add('in-chat');
    });
});

if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', () => {
        appScreen.classList.remove('in-chat');
    });
}