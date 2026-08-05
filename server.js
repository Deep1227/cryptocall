const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

const onlineUsers = {}; 
const socketToEmail = {}; 

io.on('connection', (socket) => {
    
    // 1. User Online Registration
    socket.on('user-online', (data) => {
        if (!data || !data.email) return;
        const email = data.email.toLowerCase().trim();
        onlineUsers[email] = socket.id;
        socketToEmail[socket.id] = email;
        console.log(`[SECURE] User Online: ${email}`);
    });

    // 2. Strict User Verification
    socket.on('check-user-exists', (email, callback) => {
        if (!email) return callback({ exists: false });
        const targetEmail = email.toLowerCase().trim();
        const isOnline = !!onlineUsers[targetEmail]; 
        callback({ exists: isOnline });
    });

    // 3. Route Text Messages & Handle Ticks
    socket.on('send-message', (data, callback) => {
        if (!data || !data.to || !data.text) return;
        
        const toEmail = data.to.toLowerCase().trim();
        const targetSocket = onlineUsers[toEmail];
        const senderEmail = socketToEmail[socket.id];
        
        if (targetSocket && senderEmail) {
            // Forward message to the receiver
            io.to(targetSocket).emit('receive-message', {
                from: senderEmail,
                text: data.text,
                msgId: data.msgId
            });
            // Acknowledge Delivery back to sender (Double Gray Ticks)
            if (typeof callback === 'function') {
                callback({ status: 'delivered', msgId: data.msgId });
            }
        } else {
            // User is offline - leave as Sent (Single Gray Tick)
            if (typeof callback === 'function') {
                callback({ status: 'sent', msgId: data.msgId }); 
            }
        }
    });

    // 4. Handle "Read Receipts" (Blue Ticks)
    socket.on('message-seen', (data) => {
        if (!data || !data.to) return;
        const senderSocket = onlineUsers[data.to.toLowerCase().trim()];
        if (senderSocket) {
            io.to(senderSocket).emit('message-seen-update', { 
                msgId: data.msgId 
            });
        }
    });

    // 5. Video Call Signaling
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
            console.log(`[DISCONNECT] ${email} disconnected.`);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Zero-Log Server running on port ${PORT}`));