const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

// Network mappings
const onlineUsers = {}; // email -> socket.id
const socketToEmail = {}; // socket.id -> email

io.on('connection', (socket) => {
    
    // 1. User comes online with Unique UID and Email
    socket.on('user-online', (data) => {
        if (!data || !data.email) return;
        const email = data.email.toLowerCase().trim();
        onlineUsers[email] = socket.id;
        socketToEmail[socket.id] = email;
        console.log(`🔒 User Online: ${email} | UID: ${data.uid}`);
    });

    // 2. Check if user is ONLINE before creating chat
    socket.on('check-user-exists', (email, callback) => {
        const targetEmail = email.toLowerCase().trim();
        // Since it's zero-log, they MUST be currently online to chat
        const isOnline = !!onlineUsers[targetEmail]; 
        callback({ exists: isOnline });
    });

    // 3. Route Text Messages
    socket.on('send-message', (data) => {
        const toEmail = data.to.toLowerCase().trim();
        const targetSocket = onlineUsers[toEmail];
        if (targetSocket) {
            io.to(targetSocket).emit('receive-message', {
                from: socketToEmail[socket.id],
                text: data.text
            });
        }
    });

    // 4. Route WebRTC Video Call Signals
    socket.on('webrtc-signal', (data) => {
        const toEmail = data.to.toLowerCase().trim();
        const targetSocket = onlineUsers[toEmail];
        if (targetSocket) {
            io.to(targetSocket).emit('webrtc-signal', {
                from: socketToEmail[socket.id],
                signal: data.signal
            });
        }
    });

    // 5. Sync Call Ending across both sides
    socket.on('end-call', (data) => {
        if (data && data.to) {
            const toEmail = data.to.toLowerCase().trim();
            const targetSocket = onlineUsers[toEmail];
            if (targetSocket) {
                io.to(targetSocket).emit('call-ended');
            }
        }
    });

    socket.on('disconnect', () => {
        const email = socketToEmail[socket.id];
        if (email) {
            delete onlineUsers[email];
            delete socketToEmail[socket.id];
            console.log(`💨 ${email} disconnected.`);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Zero-Log Server running on port ${PORT}`));