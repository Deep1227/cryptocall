const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

// NEW: Track which room each user is in
const userRooms = {}; 

io.on('connection', (socket) => {
    
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        userRooms[socket.id] = roomId; // Remember this user's room
        socket.to(roomId).emit('user-joined', socket.id);
    });

    socket.on('signal', (data) => {
        io.to(data.to).emit('signal', {
            from: socket.id,
            signal: data.signal
        });
    });

    // NEW: When a user closes the tab or leaves
    socket.on('disconnect', () => {
        const roomId = userRooms[socket.id];
        if (roomId) {
            // Tell the remaining person to close the call
            socket.to(roomId).emit('peer-disconnected');
            delete userRooms[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));