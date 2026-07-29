const socket = io();

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
const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatMessages = document.getElementById('chat-messages');

let localStream = null;
let peerConnection = null;
let dataChannel = null; // NEW: Direct P2P text channel
let currentRoom = null;
let isAudioMuted = false;
let isVideoStopped = false;

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 10);
}

async function startLocalVideo() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
}

function createPeerConnection(peerId) {
    peerConnection = new RTCPeerConnection(rtcConfig);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', { to: peerId, signal: { candidate: event.candidate } });
        }
    };

    // NEW: Create Data Channel for instant chat
    dataChannel = peerConnection.createDataChannel('chat');
    setupDataChannel(dataChannel);

    // NEW: Listen for peer's Data Channel
    peerConnection.ondatachannel = (event) => {
        setupDataChannel(event.channel);
    };
}

// NEW: Handle instant P2P messages
function setupDataChannel(channel) {
    channel.onmessage = (event) => {
        appendMessage(event.data, 'peer');
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
    if (!code) return;
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
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
    }
});

// NEW: Listen for ghost call fix
socket.on('peer-disconnected', () => {
    alert("The other person has left the call.");
    window.location.reload(); 
});

micBtn.addEventListener('click', () => {
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isAudioMuted);
    micBtn.innerText = isAudioMuted ? "🔇 Unmute" : "🎤 Mute";
    micBtn.classList.toggle('off-state', isAudioMuted);
});

camBtn.addEventListener('click', () => {
    isVideoStopped = !isVideoStopped;
    localStream.getVideoTracks().forEach(t => t.enabled = !isVideoStopped);
    camBtn.innerText = isVideoStopped ? "📷 Cam Off" : "📷 Cam On";
    camBtn.classList.toggle('off-state', isVideoStopped);
});

leaveBtn.addEventListener('click', () => window.location.reload());

function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('msg', sender);
    msgDiv.innerText = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// UPGRADED: Instant Chat sending
function sendTextMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    appendMessage(text, 'me');
    chatInput.value = '';
    if (dataChannel && dataChannel.readyState === 'open') {
        dataChannel.send(text);
    }
}

sendChatBtn.addEventListener('click', sendTextMessage);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendTextMessage(); });