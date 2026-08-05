import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const logoutBtn = document.getElementById('logout-btn');
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
const closeChatBtn = document.getElementById('close-chat-btn');

const videoOverlay = document.getElementById('video-overlay');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const startCallBtn = document.getElementById('start-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');

let currentUser = null;
let activeChatEmail = null; 
let currentCallPeer = null; // Explicit call peer tracking
let localStream = null;
let peerConnection = null;
let isAudioMuted = false;
let isVideoStopped = false;

// Stealth Mode State
let secretPIN = localStorage.getItem('cryptoPIN') || '1234'; 
let hiddenEmails = JSON.parse(localStorage.getItem('hiddenEmails')) || [];
let isUnlocked = false;

// ==========================================
// 3. AUTHENTICATION & LOGOUT LOGIC
// ==========================================
loginBtn.addEventListener('click', async () => {
    const email = authEmail.value.trim().toLowerCase();
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

// Logout functionality
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        activeChatEmail = null;
        currentUser = null;
        chatList.innerHTML = '';
        chatMessages.innerHTML = '';
        alert("Logged out successfully!");
    } catch (err) {
        alert("Logout error: " + err.message);
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        const normalizedEmail = user.email.toLowerCase().trim();
        myEmailDisplay.innerText = normalizedEmail;
        myAvatar.innerText = normalizedEmail.charAt(0).toUpperCase();
        
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        loginBtn.innerText = "Log In / Sign Up";

        // Emit unique UID & normalized email
        socket.emit('user-online', { email: normalizedEmail, uid: user.uid });
        chatList.innerHTML = ''; 
    } else {
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
});

// ==========================================
// 4. CHAT, SEARCH & STEALTH LOGIC
// ==========================================
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const text = searchInput.value.trim();
        if (!text) return;

        // PIN unlock check
        if (text === secretPIN) {
            isUnlocked = true;
            searchInput.value = '';
            searchInput.placeholder = "🔓 Unlocked! Search emails...";
            hiddenEmails.forEach(email => openChatWith(email));
            return;
        }

        // PIN change command
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

        if (text.startsWith('/')) {
            alert("Invalid command! Type your PIN to unlock, or /pin to change it.");
            searchInput.value = '';
            return;
        }

        const targetEmail = text.toLowerCase().trim();
        if (targetEmail === currentUser.email.toLowerCase().trim()) {
            alert("Aap khud ko message nahi kar sakte!");
            return;
        }

        // Check if target user actually exists on server
        socket.emit('check-user-exists', targetEmail, (response) => {
            if (response && response.exists) {
                openChatWith(targetEmail);
                searchInput.value = '';
            } else {
                alert(`User '${targetEmail}' exist nahi karta hai! User online ya registered hona chahiye.`);
            }
        });
    }
});

function openChatWith(email) {
    const normalizedEmail = email.toLowerCase().trim();
    activeChatEmail = normalizedEmail;
    activeChatEmailDisplay.innerText = normalizedEmail;
    activeAvatar.innerText = normalizedEmail.charAt(0).toUpperCase();
    chatMessages.innerHTML = '<div class="system-message">🔒 Messages are end-to-end encrypted. No call logs are saved.</div>';
    
    if (!document.getElementById(`contact-${normalizedEmail}`)) {
        if (!hiddenEmails.includes(normalizedEmail) || isUnlocked) {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item active';
            chatItem.id = `contact-${normalizedEmail}`;
            chatItem.innerHTML = `
                <div class="avatar">${normalizedEmail.charAt(0).toUpperCase()}</div>
                <div class="chat-info">
                    <div class="chat-name">${normalizedEmail}</div>
                    <div class="chat-preview">Tap to chat...</div>
                </div>
            `;
            chatItem.addEventListener('click', () => {
                document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
                chatItem.classList.add('active');
                openChatWith(normalizedEmail);
            });
            chatList.prepend(chatItem);
        }
    }
    
    appScreen.classList.add('in-chat'); 
}

// Hide chat (Ghost Mode)
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
    
    alert("Ghost Mode Activated 👻. Chat hidden successfully!");
});

// Delete chat
closeChatBtn.addEventListener('click', () => {
    if (!activeChatEmail) return;

    const chatNode = document.getElementById(`contact-${activeChatEmail}`);
    if (chatNode) chatNode.remove();

    hiddenEmails = hiddenEmails.filter(email => email !== activeChatEmail);
    localStorage.setItem('hiddenEmails', JSON.stringify(hiddenEmails));

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
    const fromEmail = data.from.toLowerCase().trim();
    if (activeChatEmail !== fromEmail) openChatWith(fromEmail);
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
// 5. ZERO-LOG VIDEO CALL LOGIC (SYNCED)
// ==========================================
const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function setupWebRTC(targetEmail, isCaller) {
    currentCallPeer = targetEmail.toLowerCase().trim();
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        videoOverlay.classList.remove('hidden');

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate && currentCallPeer) {
                socket.emit('webrtc-signal', { to: currentCallPeer, signal: { candidate: event.candidate } });
            }
        };

        if (isCaller) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('webrtc-signal', { to: currentCallPeer, signal: { offer: offer } });
        }
    } catch (err) {
        alert("Camera/Microphone permission denied: " + err.message);
        closeCallUI();
    }
}

startCallBtn.addEventListener('click', () => {
    if (activeChatEmail) setupWebRTC(activeChatEmail, true);
    else alert("Pehle ek chat select karein!");
});

socket.on('webrtc-signal', async (data) => {
    const senderEmail = data.from.toLowerCase().trim();

    if (!peerConnection) {
        openChatWith(senderEmail);
        await setupWebRTC(senderEmail, false);
    }

    if (data.signal.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('webrtc-signal', { to: senderEmail, signal: { answer: answer } });
    } 
    else if (data.signal.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
    } 
    else if (data.signal.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
    }
});

micBtn.addEventListener('click', () => {
    if (!localStream) return;
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isAudioMuted);
    micBtn.innerText = isAudioMuted ? "🔇 Unmute" : "🎤 Mute";
});

camBtn.addEventListener('click', () => {
    if (!localStream) return;
    isVideoStopped = !isVideoStopped;
    localStream.getVideoTracks().forEach(t => t.enabled = !isVideoStopped);
    camBtn.innerText = isVideoStopped ? "📷 Cam On" : "📷 Cam Off";
});

// End call emits signal to peer
endCallBtn.addEventListener('click', () => {
    if (currentCallPeer) {
        socket.emit('end-call', { to: currentCallPeer });
    }
    closeCallUI();
});

// Remote side receives call ended event
socket.on('call-ended', () => {
    closeCallUI();
});

function closeCallUI() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    currentCallPeer = null;
    videoOverlay.classList.add('hidden');
}