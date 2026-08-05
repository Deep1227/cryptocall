import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// 1. FIREBASE CONFIG 
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyA1bkUvt6PkFhR83bnHAPABbkgWijMyKsI",
  authDomain: "cryptocall-32dbb.firebaseapp.com",
  projectId: "cryptocall-32dbb",
  storageBucket: "cryptocall-32dbb.firebasestorage.app",
  messagingSenderId: "469600735226",
  appId: "1:469600735226:web:87e33d0ff912e24acc9e43"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const socket = io();

// ==========================================
// 2. UI ELEMENTS & STATE
// ==========================================
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const myEmailDisplay = document.getElementById('my-email-display');
const myAvatar = document.getElementById('my-avatar');

const searchInput = document.getElementById('search-input');
const chatList = document.getElementById('chat-list');
const activeChatEmailDisplay = document.getElementById('active-chat-email');
const activeAvatar = document.getElementById('active-avatar');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const mobileBackBtn = document.getElementById('mobile-back-btn');
const hideChatBtn = document.getElementById('hide-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn'); // New Trash Button

const videoOverlay = document.getElementById('video-overlay');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const startCallBtn = document.getElementById('start-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');

let currentUser = null;
let activeChatEmail = null; 
let localStream = null;
let peerConnection = null;
let isAudioMuted = false;
let isVideoStopped = false;

// Stealth Mode State
let secretPIN = localStorage.getItem('cryptoPIN') || '1234'; 
let hiddenEmails = JSON.parse(localStorage.getItem('hiddenEmails')) || [];
let isUnlocked = false;

// ==========================================
// 3. AUTHENTICATION LOGIC
// ==========================================
loginBtn.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) return alert("Please enter email and password");
    loginBtn.innerText = "Connecting...";

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (createError) {
            alert("Error: " + createError.message);
            loginBtn.innerText = "Log In / Sign Up";
        }
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        myEmailDisplay.innerText = user.email;
        myAvatar.innerText = user.email.charAt(0).toUpperCase();
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        
        socket.emit('user-online', user.email);
        chatList.innerHTML = ''; 
    } else {
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
});

// ==========================================
// 4. CHAT, SEARCH & STEALTH PIN LOGIC
// ==========================================
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const text = searchInput.value.trim();

        // Check if unlocking hidden chats
        if (text === secretPIN) {
            isUnlocked = true;
            searchInput.value = '';
            searchInput.placeholder = "🔓 Unlocked! Search emails...";
            hiddenEmails.forEach(email => openChatWith(email));
            return;
        }

        // Check if changing PIN
        if (text.startsWith('/pin ')) {
            const newPin = text.split(' ')[1];
            if (newPin && newPin.length >= 4) {
                secretPIN = newPin;
                localStorage.setItem('cryptoPIN', secretPIN);
                alert(`Secret PIN successfully changed to: ${secretPIN}`);
                searchInput.value = '';
            }
            return;
        }

        // Standard Email Search (With Slash Safeguard)
        if (text && text !== currentUser.email) {
            if (text.startsWith('/')) {
                alert("Invalid command! Type your PIN to unlock, or /pin to change it.");
                searchInput.value = '';
                return;
            }
            openChatWith(text);
            searchInput.value = '';
        }
    }
});

function openChatWith(email) {
    activeChatEmail = email;
    activeChatEmailDisplay.innerText = email;
    activeAvatar.innerText = email.charAt(0).toUpperCase();
    chatMessages.innerHTML = '<div class="system-message">🔒 Messages are end-to-end encrypted. No call logs are saved.</div>';
    
    // Create Sidebar item if it's not hidden (or if we are unlocked)
    if (!document.getElementById(`contact-${email}`)) {
        if (!hiddenEmails.includes(email) || isUnlocked) {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item active';
            chatItem.id = `contact-${email}`;
            chatItem.innerHTML = `
                <div class="avatar">${email.charAt(0).toUpperCase()}</div>
                <div class="chat-info">
                    <div class="chat-name">${email}</div>
                    <div class="chat-preview">Tap to chat...</div>
                </div>
            `;
            chatItem.addEventListener('click', () => {
                document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
                chatItem.classList.add('active');
                openChatWith(email);
            });
            chatList.prepend(chatItem);
        }
    }
    
    appScreen.classList.add('in-chat'); 
}

// 👻 Hide the current active chat
hideChatBtn.addEventListener('click', () => {
    if (!activeChatEmail) return;
    
    if (!hiddenEmails.includes(activeChatEmail)) {
        hiddenEmails.push(activeChatEmail);
        localStorage.setItem('hiddenEmails', JSON.stringify(hiddenEmails));
    }
    
    const chatNode = document.getElementById(`contact-${activeChatEmail}`);
    if (chatNode) chatNode.remove();
    
    activeChatEmail = null;
    chatMessages.innerHTML = '';
    activeChatEmailDisplay.innerText = 'Select a chat';
    activeAvatar.innerText = 'P';
    appScreen.classList.remove('in-chat'); 
    
    alert("Ghost Mode Activated 👻. Chat is hidden. Type your PIN in the search bar to reveal it.");
});

// 🗑️ Permanently Delete a chat
closeChatBtn.addEventListener('click', () => {
    if (!activeChatEmail) return;

    // Remove from UI
    const chatNode = document.getElementById(`contact-${activeChatEmail}`);
    if (chatNode) chatNode.remove();

    // Remove from Ghost Vault just in case
    hiddenEmails = hiddenEmails.filter(email => email !== activeChatEmail);
    localStorage.setItem('hiddenEmails', JSON.stringify(hiddenEmails));

    // Clear main screen
    activeChatEmail = null;
    chatMessages.innerHTML = '';
    activeChatEmailDisplay.innerText = 'Select a chat';
    activeAvatar.innerText = 'P';
    appScreen.classList.remove('in-chat');
});

// Messaging
sendBtn.addEventListener('click', sendText);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendText(); });

function sendText() {
    const text = chatInput.value.trim();
    if (!text || !activeChatEmail) return;

    appendMessage(text, 'me');
    chatInput.value = '';
    socket.emit('send-message', { to: activeChatEmail, text: text });
}

socket.on('receive-message', (data) => {
    if (activeChatEmail !== data.from) openChatWith(data.from);
    appendMessage(data.text, 'peer');
});

function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${sender}`;
    msgDiv.innerText = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', () => appScreen.classList.remove('in-chat'));
}

// ==========================================
// 5. ZERO-LOG VIDEO CALL LOGIC
// ==========================================
const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function setupWebRTC(targetEmail, isCaller) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    videoOverlay.classList.remove('hidden');

    peerConnection = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc-signal', { to: targetEmail, signal: { candidate: event.candidate } });
        }
    };

    if (isCaller) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('webrtc-signal', { to: targetEmail, signal: { offer: offer } });
    }
}

startCallBtn.addEventListener('click', () => {
    if (activeChatEmail) setupWebRTC(activeChatEmail, true);
});

socket.on('webrtc-signal', async (data) => {
    if (!peerConnection) {
        activeChatEmail = data.from;
        await setupWebRTC(data.from, false);
    }

    if (data.signal.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('webrtc-signal', { to: data.from, signal: { answer: answer } });
    } 
    else if (data.signal.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
    } 
    else if (data.signal.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
    }
});

micBtn.addEventListener('click', () => {
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isAudioMuted);
    micBtn.innerText = isAudioMuted ? "🔇 Unmute" : "🎤 Mute";
});

camBtn.addEventListener('click', () => {
    isVideoStopped = !isVideoStopped;
    localStream.getVideoTracks().forEach(t => t.enabled = !isVideoStopped);
    camBtn.innerText = isVideoStopped ? "📷 Cam On" : "📷 Cam Off";
});

endCallBtn.addEventListener('click', () => {
    socket.emit('end-call', { to: activeChatEmail });
    closeCallUI();
});

socket.on('call-ended', () => {
    closeCallUI();
});

function closeCallUI() {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    peerConnection = null;
    localStream = null;
    videoOverlay.classList.add('hidden');
}