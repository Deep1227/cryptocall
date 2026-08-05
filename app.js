import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 1. FIREBASE CONFIG
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

// 2. UI ELEMENTS
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
let currentCallPeer = null; 
let localStream = null;
let peerConnection = null;

let secretPIN = localStorage.getItem('cryptoPIN') || '1234'; 
let hiddenEmails = [];
let isUnlocked = false;

try {
    const stored = localStorage.getItem('hiddenEmails');
    if (stored) {
        hiddenEmails = JSON.parse(stored);
        if (!Array.isArray(hiddenEmails)) hiddenEmails = [];
    }
} catch (err) {
    hiddenEmails = [];
    localStorage.removeItem('hiddenEmails');
}

// 3. AUTH & SOCKET RECONNECTION
socket.on('connect', () => {
    if (currentUser) {
        socket.emit('user-online', { email: currentUser.email, uid: currentUser.uid });
    }
});

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

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    activeChatEmail = null;
    currentUser = null;
    chatList.innerHTML = '';
    chatMessages.innerHTML = '';
    alert("Logged out successfully!");
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
        socket.emit('user-online', { email: normalizedEmail, uid: user.uid });
    } else {
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
});

// 4. CHAT, SEARCH & STEALTH
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const text = searchInput.value.trim();
        if (!text) return;

        if (text === secretPIN) {
            isUnlocked = true;
            searchInput.value = '';
            searchInput.placeholder = "[Unlocked] Search emails...";
            hiddenEmails.forEach(email => openChatWith(email));
            return;
        }

        if (text.startsWith('/pin ')) {
            secretPIN = text.split(' ')[1];
            localStorage.setItem('cryptoPIN', secretPIN);
            alert(`PIN changed to: ${secretPIN}`);
            searchInput.value = '';
            return;
        }

        const targetEmail = text.toLowerCase().trim();
        
        // Strict Reflection Check
        if (targetEmail === currentUser.email.toLowerCase().trim()) {
            alert("You cannot chat with yourself!");
            searchInput.value = '';
            return;
        }

        socket.emit('check-user-exists', targetEmail, (response) => {
            if (response && response.exists) {
                openChatWith(targetEmail);
                searchInput.value = '';
            } else {
                alert(`User '${targetEmail}' is offline or does not exist!`);
            }
        });
    }
});

function openChatWith(email) {
    const normalizedEmail = email.toLowerCase().trim();
    activeChatEmail = normalizedEmail;
    activeChatEmailDisplay.innerText = normalizedEmail;
    activeAvatar.innerText = normalizedEmail.charAt(0).toUpperCase();
    chatMessages.innerHTML = '<div class="system-message">🔒 End-to-end encrypted.</div>';
    
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

hideChatBtn.addEventListener('click', () => {
    if (!activeChatEmail) return;
    if (!hiddenEmails.includes(activeChatEmail)) {
        hiddenEmails.push(activeChatEmail);
        localStorage.setItem('hiddenEmails', JSON.stringify(hiddenEmails));
    }
    const chatNode = document.getElementById(`contact-${activeChatEmail}`);
    if (chatNode) chatNode.remove();
    activeChatEmail = null;
    appScreen.classList.remove('in-chat'); 
});

closeChatBtn.addEventListener('click', () => {
    if (!activeChatEmail) return;
    const chatNode = document.getElementById(`contact-${activeChatEmail}`);
    if (chatNode) chatNode.remove();
    hiddenEmails = hiddenEmails.filter(email => email !== activeChatEmail);
    localStorage.setItem('hiddenEmails', JSON.stringify(hiddenEmails));
    activeChatEmail = null;
    appScreen.classList.remove('in-chat');
});

// 5. MESSAGING & TICK STATUS ENGINE
sendBtn.addEventListener('click', sendText);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendText(); });

function sendText() {
    const text = chatInput.value.trim();
    if (!text || !activeChatEmail) return;

    // Generate unique ID for ticks
    const msgId = 'msg-' + Date.now();
    appendMessage(text, 'me', msgId);
    chatInput.value = '';

    // Send to server with callback to catch delivery
    socket.emit('send-message', { to: activeChatEmail, text: text, msgId: msgId }, (ack) => {
        const tickElement = document.getElementById(`tick-${ack.msgId}`);
        if (tickElement) {
            if (ack.status === 'delivered') {
                tickElement.innerText = '✓✓'; // Double tick
            }
        }
    });
}

socket.on('receive-message', (data) => {
    if (!data || !data.from) return;
    const fromEmail = data.from.toLowerCase().trim();
    
    if (activeChatEmail !== fromEmail) {
        openChatWith(fromEmail);
    }
    
    appendMessage(data.text, 'peer', null);

    // If chat is open, immediately emit "Seen" back to sender
    if (activeChatEmail === fromEmail) {
        socket.emit('message-seen', { to: fromEmail, msgId: data.msgId });
    }
});

// Triggered when the other user sees your message
socket.on('message-seen-update', (data) => {
    const tickElement = document.getElementById(`tick-${data.msgId}`);
    if (tickElement) {
        tickElement.innerText = '✓✓';
        tickElement.classList.add('seen'); // Turns it blue
    }
});

function appendMessage(text, sender, msgId) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${sender}`;
    
    let innerHTML = `<span>${text}</span>`;
    
    // Only add ticks if it's our own message
    if (sender === 'me' && msgId) {
        innerHTML += `
            <div class="msg-meta">
                <span id="tick-${msgId}" class="msg-status sent">✓</span>
            </div>
        `;
    }

    msgDiv.innerHTML = innerHTML;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', () => appScreen.classList.remove('in-chat'));
}

// 6. VIDEO CALL LOGIC
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function setupWebRTC(targetEmail, isCaller) {
    currentCallPeer = targetEmail;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        videoOverlay.classList.remove('hidden');

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => { remoteVideo.srcObject = event.streams[0]; };

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
        alert("Camera/Mic denied.");
        closeCallUI();
    }
}

startCallBtn.addEventListener('click', () => {
    if (activeChatEmail) setupWebRTC(activeChatEmail, true);
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
    } else if (data.signal.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
    } else if (data.signal.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
    }
});

endCallBtn.addEventListener('click', () => {
    if (currentCallPeer) socket.emit('end-call', { to: currentCallPeer });
    closeCallUI();
});

socket.on('call-ended', () => closeCallUI());

function closeCallUI() {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    peerConnection = null;
    localStream = null;
    currentCallPeer = null;
    videoOverlay.classList.add('hidden');
}