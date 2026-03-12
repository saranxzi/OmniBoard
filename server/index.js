const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Room states: Map<roomId, Map<elementId, Element>>
const rooms = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);

        // Send existing room state to the new user
        if (rooms.has(roomId)) {
            const elements = Array.from(rooms.get(roomId).values());
            socket.emit('init-room', elements);
        } else {
            rooms.set(roomId, new Map());
        }
    });

    socket.on('draw-element', ({ roomId, element }) => {
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        
        // Save to server state
        rooms.get(roomId).set(element.id, element);

        // Broadcast to everyone else in the room
        socket.to(roomId).emit('update-element', element);
    });

    socket.on('erase-element', ({ roomId, elementId }) => {
        if (rooms.has(roomId)) {
            rooms.get(roomId).delete(elementId);
            socket.to(roomId).emit('remove-element', elementId);
        }
    });

    socket.on('clear-canvas', (roomId) => {
        if (rooms.has(roomId)) {
            rooms.get(roomId).clear();
            socket.to(roomId).emit('canvas-cleared');
        }
    });

    socket.on('cursor-move', ({ roomId, user, x, y }) => {
        socket.to(roomId).emit('cursor-update', {
            socketId: socket.id,
            user,
            x,
            y
        });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Let rooms know a cursor dropped
        // For a tighter implementation, track which room the socket was in and emit 'cursor-remove'
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`WebSocket Server running on http://localhost:${PORT}`);
});
