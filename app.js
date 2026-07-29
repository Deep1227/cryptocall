// Connect to our Node.js signaling server
const socket = io();

// UI Elements
const setupScreen = document.getElementById('setup-screen');
const videoScreen = document.getElementById('video-screen');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const leaveBtn = document.getElementById('leave-btn');
const roomInput = document.getElementById('room-input');
const displayRoomCode = document.getElementById('display-room-code');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

let localStream = null;
let peerConnection = null;
let currentRoom = null;

// Free public STUN servers (Helps peers find each other's public IP addresses)
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

// Initialize WebRTC Peer Connection
function createPeerConnection(peerId) {
    peerConnection = new RTCPeerConnection(rtcConfig);

    // Add our local video/audio tracks to the connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // When we receive video/audio tracks from the other person
    peerConnection.ontrack = (event) => {
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    // When the browser finds its network path (ICE Candidate), send it to the peer
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', {
                to: peerId,
                signal: { candidate: event.candidate }
            });
        }
    };
}

// Action: Create Room
createBtn.addEventListener('click', async () => {
    currentRoom = generateRoomCode();
    displayRoomCode.innerText = currentRoom;
    
    await startLocalVideo();
    
    setupScreen.classList.add('hidden');
    videoScreen.classList.remove('hidden');
    
    socket.emit('join-room', currentRoom);
});

// Action: Join Room
joinBtn.addEventListener('click', async () => {
    const code = roomInput.value.trim();
    if (!code) return alert("Please enter a room code.");
    
    currentRoom = code;
    displayRoomCode.innerText = currentRoom;
    
    await startLocalVideo();
    
    setupScreen.classList.add('hidden');
    videoScreen.classList.remove('hidden');
    
    socket.emit('join-room', currentRoom);
});

// --- SIGNALING HANDSHAKE LOGIC ---

// Server tells us another user has joined our room
socket.on('user-joined', async (peerId) => {
    console.log('Peer joined! Initiating call...');
    createPeerConnection(peerId);
    
    // Create an "Offer" (Hey, want to connect?)
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    socket.emit('signal', { to: peerId, signal: { offer: offer } });
});

// Handle incoming signals (Offers, Answers, and Network paths)
socket.on('signal', async (data) => {
    if (!peerConnection) createPeerConnection(data.from);

    if (data.signal.offer) {
        // We received an offer -> Set it and send back an "Answer"
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { to: data.from, signal: { answer: answer } });
    } 
    else if (data.signal.answer) {
        // We received the answer -> complete the handshake
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
    } 
    else if (data.signal.candidate) {
        // Add network routing path
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
        } catch (e) {
            console.error("Error adding received ICE candidate", e);
        }
    }
});

// Action: Leave Call
leaveBtn.addEventListener('click', () => {
    window.location.reload(); // Quick way to reset all connections and state cleanly
});// Controls State Tracker
let isAudioMuted = false;
let isVideoStopped = false;

const micBtn = document.getElementById('mic-btn');
const camBtn = document.getElementById('cam-btn');

// Toggle Microphone Track
micBtn.addEventListener('click', () => {
    if (!localStream) return;
    
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioMuted;
    });
    
    micBtn.innerText = isAudioMuted ? "🔇 Unmute Mic" : "🎤 Mute Mic";
    micBtn.style.background = isAudioMuted ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 255, 255, 0.2)";
});

// Toggle Camera Track
camBtn.addEventListener('click', () => {
    if (!localStream) return;
    
    isVideoStopped = !isVideoStopped;
    localStream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoStopped;
    });
    
    camBtn.innerText = isVideoStopped ? "📷 Turn On Cam" : "📷 Turn Off Cam";
    camBtn.style.background = isVideoStopped ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 255, 255, 0.2)";
});