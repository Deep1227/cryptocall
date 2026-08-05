const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

// Network mappings
const onlineUsers = {}; 
const socketToEmail = {}; 

io.on('connection', (socket) => {
    
    // 1. User online
    socket.on('user-online', (data) => {
        if (!data || !data.email) return;
        const email = data.email.toLowerCase().trim();
        onlineUsers[email] = socket.id;
        socketToEmail[socket.id] = email;
        console.log(`[SECURE] User Online: ${email}`);
    });

    // 2. Check if user is ONLINE
    socket.on('check-user-exists', (email, callback) => {
        if (!email) return callback({ exists: false });
        const targetEmail = email.toLowerCase().trim();
        const isOnline = !!onlineUsers[targetEmail]; 
        callback({ exists: isOnline });
    });

    // 3. Route Text Messages Safely
    socket.on('send-message', (data) => {
        if (!data || !data.to || !data.text) return;
        const toEmail = data.to.toLowerCase().trim();
        const targetSocket = onlineUsers[toEmail];
        const senderEmail = socketToEmail[socket.id];
        
        if (targetSocket && senderEmail) {
            io.to(targetSocket).emit('receive-message', {
                from: senderEmail,
                text: data.text
            });
        }
    });

    // 4. Route WebRTC Signals
    socket.on('webrtc-signal', (data) => {
        if (!data || !data.to) return;
        const toEmail = data.to.toLowerCase().trim();
        const targetSocket = onlineUsers[toEmail];
        const senderEmail = socketToEmail[socket.id];

        if (targetSocket && senderEmail) {
            io.to(targetSocket).emit('webrtc-signal', {
                from: senderEmail,
                signal: data.signal
            });
        }
    });

    // 5. Sync Call Ending
    socket.on('end-call', (data) => {
        if (!data || !data.to) return;
        const toEmail = data.to.toLowerCase().trim();
        const targetSocket = onlineUsers[toEmail];
        if (targetSocket) {
            io.to(targetSocket).emit('call-ended');
        }
    });

    socket.on('disconnect', () => {
        const email = socketToEmail[socket.id];
        if (email) {
            delete onlineUsers[email];
            delete socketToEmail[socket.id];
            console.log(`[DISCONNECTED] ${email} left.`);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Zero-Log Server running on port ${PORT}`));