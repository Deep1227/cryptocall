const socket = io();

// UI Elements
const setupScreen = document.getElementById('setup-screen');
const videoScreen = document.getElementById('video-screen');
const mainHeader = document.getElementById('main-header');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const leaveBtn = document.getElementById('leave-btn');
const roomInput = document.getElementById('room-input');
const displayRoomCode = document.getElementById('display-room-code');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

// New Controls & Chat UI Elements
const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatMessages = document.getElementById('chat-messages');

let localStream = null;
let peerConnection = null;
let currentRoom = null;
let targetPeerId = null; 

let isAudioMuted = false;
let isVideoStopped = false;

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function generateRoomCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function startLocalVideo() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error("Error accessing media devices.", error);
        alert("Please allow camera and microphone access.");
    }
}

function createPeerConnection(peerId) {
    targetPeerId = peerId;
    peerConnection = new RTCPeerConnection(rtcConfig);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', {
                to: peerId,
                signal: { candidate: event.candidate }
            });
        }
    };
}

createBtn.addEventListener('click', async () => {
    currentRoom = generateRoomCode();
    displayRoomCode.innerText = currentRoom;
    await startLocalVideo();
    setupScreen.classList.add('hidden');
    mainHeader.classList.add('hidden');
    videoScreen.classList.remove('hidden');
    socket.emit('join-room', currentRoom);
});

joinBtn.addEventListener('click', async () => {
    const code = roomInput.value.trim();
    if (!code) return alert("Please enter a room code.");
    currentRoom = code;
    displayRoomCode.innerText = currentRoom;
    await startLocalVideo();
    setupScreen.classList.add('hidden');
    mainHeader.classList.add('hidden');
    videoScreen.classList.remove('hidden');
    socket.emit('join-room', currentRoom);
});

socket.on('user-joined', async (peerId) => {
    createPeerConnection(peerId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { to: peerId, signal: { offer: offer } });
});

socket.on('signal', async (data) => {
    if (!peerConnection) createPeerConnection(data.from);

    if (data.signal.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { to: data.from, signal: { answer: answer } });
    } 
    else if (data.signal.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
    } 
    else if (data.signal.candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
        } catch (e) {
            console.error("Error adding ICE candidate", e);
        }
    }
});

// --- TOGGLE CONTROLS FUNCTIONALITY ---
micBtn.addEventListener('click', () => {
    if (!localStream) return;
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks().forEach(track => track.enabled = !isAudioMuted);
    micBtn.innerText = isAudioMuted ? "🔇 Unmute Mic" : "🎤 Mute Mic";
    micBtn.style.background = isAudioMuted ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 255, 255, 0.2)";
});

camBtn.addEventListener('click', () => {
    if (!localStream) return;
    isVideoStopped = !isVideoStopped;
    localStream.getVideoTracks().forEach(track => track.enabled = !isVideoStopped);
    camBtn.innerText = isVideoStopped ? "📷 Turn On Cam" : "📷 Turn Off Cam";
    camBtn.style.background = isVideoStopped ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 255, 255, 0.2)";
});

leaveBtn.addEventListener('click', () => {
    window.location.reload();
});

// --- TEXT CHAT FUNCTIONALITY ---
function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('msg', sender);
    msgDiv.innerText = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scrolls down
}

function sendTextMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    // Append to our window
    appendMessage(text, 'me');
    chatInput.value = '';

    // Send to peer over signaling network
    if (targetPeerId) {
        socket.emit('signal', {
            to: targetPeerId,
            signal: { chatMessage: text }
        });
    }
}

sendChatBtn.addEventListener('click', sendTextMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendTextMessage();
});

// Handle receiving text message packet
socket.on('signal', (data) => {
    if (data.signal.chatMessage) {
        appendMessage(data.signal.chatMessage, 'peer');
    }
});