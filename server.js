const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// This tells the server to host your index.html, style.css, and app.js
app.use(express.static(__dirname));

// Listen for connections from browsers
io.on('connection', (socket) => {
    console.log('A new user connected! ID:', socket.id);

    // When a user joins a specific room code
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        
        // Tell everyone else in that room that a new person arrived
        socket.to(roomId).emit('user-joined', socket.id);
    });

    // Relay the WebRTC encryption keys and network data (The Handshake)
    socket.on('signal', (data) => {
        io.to(data.to).emit('signal', {
            from: socket.id,
            signal: data.signal
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start the server on port 3000
const PORT = 3000;
http.listen(PORT, () => {
    console.log(`🚀 Signaling server is ALIVE! Go to http://localhost:${PORT}`);
});