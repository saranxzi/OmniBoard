const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const registerHandlers = require('./socketHandlers');
const { markRoomDirty, loadRoomFromDb, startSaveLoop, flushRoom } = require('./persistence');

const app = express();
const origin = process.env.CLIENT_URL || process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000';
app.use(cors({ origin }));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin,
        methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 5e6, // 5MB max per message (increased for image uploads)
    pingTimeout: 20000,
    pingInterval: 25000,
});

// --- Shared State ---
const state = {
    rooms: new Map(),           // roomId -> Map<elementId, Element>
    socketMeta: new Map(),      // socketId -> { roomId, userName }
    socketRates: new Map(),     // socketId -> { count, resetAt }
    roomMetadata: new Map(),    // roomId -> { guestCounter }
    roomLocks: new Map(),       // roomId -> Map<elementId, { socketId, userName, lockedAt }>
    markRoomDirty,              // Hook for persistence layer
};

// --- Lifecycle & GC ---
io.of('/').adapter.on('empty-room', (room) => {
    if (state.rooms.has(room) && room.length > 10) {
        setTimeout(async () => {
            const activeSockets = io.sockets.adapter.rooms.get(room);
            if (!activeSockets || activeSockets.size === 0) {
                // Flush to DB before purging from RAM
                const elementsMap = state.rooms.get(room);
                if (elementsMap) {
                    await flushRoom(room, elementsMap);
                }
                state.rooms.delete(room);
                state.roomLocks.delete(room);
                console.log(`[GC] ♻️ Purged room ${room}`);
            }
        }, 120_000);
    }
});

// --- Connection Handler ---
io.on('connection', (socket) => {
    registerHandlers(io, socket, state);
});

// --- Start Persistence Save Loop ---
startSaveLoop(state.rooms);

// --- Startup ---
const PORT = process.env.WS_PORT || 3001;
server.listen(PORT, () => {
    console.log(`[WS] Server running on http://localhost:${PORT}`);
});
