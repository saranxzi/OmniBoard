const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
    },
    // Performance: limit payload size to prevent abuse
    maxHttpBufferSize: 1e6, // 1MB max per message
    pingTimeout: 20000,
    pingInterval: 25000,
});

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

/** Room states: Map<roomId, Map<elementId, Element>> */
const rooms = new Map();

/** Track socket metadata: socketId → { roomId, userName } */
const socketMeta = new Map();

/** Per-socket rate limiter: socketId → { count, resetAt } */
const socketRates = new Map();
const MAX_EVENTS_PER_SECOND = 120; // ~2 per frame at 60fps
const RATE_WINDOW_MS = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Rate-limit a socket. Returns true if within limits.
 * @param {string} socketId
 * @returns {boolean}
 */
function isWithinRateLimit(socketId) {
    const now = Date.now();
    const record = socketRates.get(socketId);
    if (!record || now > record.resetAt) {
        socketRates.set(socketId, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    record.count++;
    return record.count <= MAX_EVENTS_PER_SECOND;
}

/**
 * Broadcast the current user list and count for a room.
 * @param {string} roomId
 */
function emitUserCount(roomId) {
    const sockets = io.sockets.adapter.rooms.get(roomId);
    const count = sockets ? sockets.size : 0;
    const users = [];
    if (sockets) {
        for (const sid of sockets) {
            const meta = socketMeta.get(sid);
            users.push({ socketId: sid, name: meta?.userName || 'Guest' });
        }
    }
    io.to(roomId).emit('room-users', { count, users });
}

// ---------------------------------------------------------------------------
// Room garbage collection — purge after 2 min of inactivity
// ---------------------------------------------------------------------------
io.of('/').adapter.on('empty-room', (room) => {
    if (rooms.has(room) && room.length > 10) {
        console.log(`[GC] Room ${room} empty. Scheduling purge in 120s…`);
        setTimeout(() => {
            const activeSockets = io.sockets.adapter.rooms.get(room);
            if (!activeSockets || activeSockets.size === 0) {
                rooms.delete(room);
                console.log(`[GC] ♻️ Purged room ${room}`);
            }
        }, 120_000);
    }
});

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
    console.log(`[WS] Connected: ${socket.id}`);

    // ------ Join Room --------------------------------------------------
    socket.on('join-room', ({ roomId, userName }) => {
        try {
            if (!roomId || typeof roomId !== 'string') return;
            const safeName = (userName || 'Guest').slice(0, 50); // Cap name length

            socket.join(roomId);
            socketMeta.set(socket.id, { roomId, userName: safeName });
            console.log(`[WS] ${safeName} joined ${roomId}`);

            if (rooms.has(roomId)) {
                socket.emit('init-room', Array.from(rooms.get(roomId).values()));
            } else {
                rooms.set(roomId, new Map());
            }

            emitUserCount(roomId);
        } catch (err) {
            console.error('[WS] join-room error:', err.message);
        }
    });

    // ------ Draw Element -----------------------------------------------
    socket.on('draw-element', ({ roomId, element }) => {
        try {
            if (!roomId || !element?.id) return;
            if (!isWithinRateLimit(socket.id)) return; // silently drop

            if (!rooms.has(roomId)) rooms.set(roomId, new Map());
            rooms.get(roomId).set(element.id, element);
            socket.to(roomId).emit('update-element', element);
        } catch (err) {
            console.error('[WS] draw-element error:', err.message);
        }
    });

    // ------ Erase Element ----------------------------------------------
    socket.on('erase-element', ({ roomId, elementId }) => {
        try {
            if (!roomId || !elementId) return;
            if (!isWithinRateLimit(socket.id)) return;

            if (rooms.has(roomId)) {
                rooms.get(roomId).delete(elementId);
                socket.to(roomId).emit('remove-element', elementId);
            }
        } catch (err) {
            console.error('[WS] erase-element error:', err.message);
        }
    });

    // ------ Clear Canvas -----------------------------------------------
    socket.on('clear-canvas', (roomId) => {
        try {
            if (!roomId) return;
            if (rooms.has(roomId)) {
                rooms.get(roomId).clear();
                socket.to(roomId).emit('canvas-cleared');
            }
        } catch (err) {
            console.error('[WS] clear-canvas error:', err.message);
        }
    });

    // ------ Cursor Move ------------------------------------------------
    socket.on('cursor-move', ({ roomId, user, x, y }) => {
        try {
            if (!roomId) return;
            if (!isWithinRateLimit(socket.id)) return;

            socket.to(roomId).emit('cursor-update', {
                socketId: socket.id, user, x, y,
            });
        } catch (err) {
            // Cursor errors are non-critical, silently ignore
        }
    });

    // ------ Disconnect -------------------------------------------------
    socket.on('disconnect', () => {
        const meta = socketMeta.get(socket.id);
        if (meta) {
            const { roomId } = meta;
            console.log(`[WS] ${meta.userName} disconnected from ${roomId}`);
            socketMeta.delete(socket.id);
            socketRates.delete(socket.id);
            io.to(roomId).emit('cursor-remove', socket.id);
            emitUserCount(roomId);
        }
    });

    // Catch any unhandled socket errors
    socket.on('error', (err) => {
        console.error(`[WS] Socket ${socket.id} error:`, err.message);
    });
});

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------
const PORT = process.env.WS_PORT || 3001;
server.listen(PORT, () => {
    console.log(`[WS] Server running on http://localhost:${PORT}`);
});
