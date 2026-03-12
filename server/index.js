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

// Track which room each socket is in
const socketRooms = new Map(); // socketId -> roomId

// Helper: broadcast the current user count for a room
function emitUserCount(roomId) {
    const sockets = io.sockets.adapter.rooms.get(roomId);
    const count = sockets ? sockets.size : 0;

    // Build list of connected user names
    const users = [];
    if (sockets) {
        for (const sid of sockets) {
            const meta = socketRooms.get(sid);
            if (meta && meta.userName) {
                users.push({ socketId: sid, name: meta.userName });
            } else {
                users.push({ socketId: sid, name: 'Guest' });
            }
        }
    }

    io.to(roomId).emit('room-users', { count, users });
}

// Memory Management: Delete rooms when they sit empty to prevent RAM bloating
io.of("/").adapter.on("empty-room", (room) => {
    if (rooms.has(room) && room.length > 20) {
        console.log(`Room ${room} is empty. Scheduling memory cleanup...`);
        setTimeout(() => {
            const activeSockets = io.sockets.adapter.rooms.get(room);
            if (!activeSockets || activeSockets.size === 0) {
                rooms.delete(room);
                console.log(`♻️ Purged inactive room ${room} from memory.`);
            }
        }, 120000);
    }
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, userName }) => {
        socket.join(roomId);
        socketRooms.set(socket.id, { roomId, userName: userName || 'Guest' });
        console.log(`${userName || 'Guest'} (${socket.id}) joined room ${roomId}`);

        // Send existing room state to the new user
        if (rooms.has(roomId)) {
            const elements = Array.from(rooms.get(roomId).values());
            socket.emit('init-room', elements);
        } else {
            rooms.set(roomId, new Map());
        }

        // Broadcast updated user count
        emitUserCount(roomId);
    });

    socket.on('draw-element', ({ roomId, element }) => {
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        rooms.get(roomId).set(element.id, element);
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
        const meta = socketRooms.get(socket.id);
        if (meta) {
            const { roomId } = meta;
            console.log(`${meta.userName} (${socket.id}) disconnected from room ${roomId}`);
            socketRooms.delete(socket.id);

            // Broadcast cursor removal and updated count
            io.to(roomId).emit('cursor-remove', socket.id);
            emitUserCount(roomId);
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`WebSocket Server running on http://localhost:${PORT}`);
});
