const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

// STEALTH MEMORY: Maps emails to current network connections. 
// Wipes instantly when someone disconnects. No database used.
const onlineUsers = {}; 
const socketToEmail = {};

io.on('connection', (socket) => {
    
    // 1. User logs in and comes online
    socket.on('user-online', (email) => {
        onlineUsers[email] = socket.id;
        socketToEmail[socket.id] = email;
        console.log(`🔒 ${email} is online and secured.`);
    });

    // 2. Route Text Messages (Instant P2P)
    socket.on('send-message', (data) => {
        const targetSocket = onlineUsers[data.to];
        if (targetSocket) {
            io.to(targetSocket).emit('receive-message', {
                from: socketToEmail[socket.id],
                text: data.text
            });
        }
    });

    // 3. Route Video Call Signals
    socket.on('webrtc-signal', (data) => {
        const targetSocket = onlineUsers[data.to];
        if (targetSocket) {
            io.to(targetSocket).emit('webrtc-signal', {
                from: socketToEmail[socket.id],
                signal: data.signal
            });
        }
    });

    // 4. Handle Disconnects & Hangups
    socket.on('end-call', (data) => {
        const targetSocket = onlineUsers[data.to];
        if (targetSocket) {
            io.to(targetSocket).emit('call-ended');
        }
    });

    socket.on('disconnect', () => {
        const email = socketToEmail[socket.id];
        if (email) {
            delete onlineUsers[email];
            delete socketToEmail[socket.id];
            console.log(`💨 ${email} vanished from network.`);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Zero-Log Server running on port ${PORT}`));