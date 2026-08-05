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
// 2. UI ELEMENTS
// ==========================================
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginBtn = document.getElementById('login-btn');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const myEmailDisplay = document.getElementById('my-email-display');
const myAvatar = document.getElementById('my-avatar');

// Chat UI Elements
const searchInput = document.getElementById('search-input');
const chatList = document.getElementById('chat-list');
const activeChatEmailDisplay = document.getElementById('active-chat-email');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const mobileBackBtn = document.getElementById('mobile-back-btn');

// Video UI Elements
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
// 4. CHAT & MESSAGING LOGIC
// ==========================================
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const targetEmail = searchInput.value.trim();
        if (targetEmail && targetEmail !== currentUser.email) {
            openChatWith(targetEmail);
            searchInput.value = '';
        }
    }
});

function openChatWith(email) {
    activeChatEmail = email;
    activeChatEmailDisplay.innerText = email;
    chatMessages.innerHTML = '<div class="system-message">🔒 Messages are end-to-end encrypted. No call logs are saved.</div>';
    
    if (!document.getElementById(`contact-${email}`)) {
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
    
    appScreen.classList.add('in-chat'); 
}

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