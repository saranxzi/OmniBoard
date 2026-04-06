const MAX_EVENTS_PER_SECOND = 120;
const RATE_WINDOW_MS = 1000;
const LOCK_EXPIRY_MS = 30000; // Auto-expire stale locks after 30 seconds

/**
 * registerHandlers — Binds all WebSocket event listeners to a specific socket.
 * Modularizes server logic and keeps index.js focused on startup.
 * Phase 2: Added element-level locking to prevent concurrent edit conflicts.
 */
module.exports = function registerHandlers(io, socket, state) {
    const { rooms, socketMeta, socketRates, roomMetadata, roomLocks } = state;

    // --- Helpers ---

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

    function emitUserCount(roomId) {
        const sockets = io.sockets.adapter.rooms.get(roomId);
        const count = sockets ? sockets.size : 0;
        const users = [];
        if (sockets) {
            for (const sid of sockets) {
                const meta = socketMeta.get(sid);
                if (meta) {
                    users.push({ socketId: sid, name: meta.userName || 'Guest' });
                }
            }
        }
        io.to(roomId).emit('room-users', { count, users });
    }

    /** Release all locks held by a socket in a room */
    function releaseAllLocks(socketId, roomId) {
        if (!roomLocks.has(roomId)) return;
        const locks = roomLocks.get(roomId);
        const released = [];
        for (const [elementId, lock] of locks) {
            if (lock.socketId === socketId) {
                released.push(elementId);
                locks.delete(elementId);
            }
        }
        released.forEach(elementId => {
            io.to(roomId).emit('element-unlocked', elementId);
        });
    }

    /** Expire stale locks older than LOCK_EXPIRY_MS */
    function expireStaleLocks(roomId) {
        if (!roomLocks.has(roomId)) return;
        const locks = roomLocks.get(roomId);
        const now = Date.now();
        for (const [elementId, lock] of locks) {
            if (now - lock.lockedAt > LOCK_EXPIRY_MS) {
                locks.delete(elementId);
                io.to(roomId).emit('element-unlocked', elementId);
            }
        }
    }

    // --- Events ---

    socket.on('join-room', async ({ roomId, userName }) => {
        try {
            if (!roomId || typeof roomId !== 'string') return;
            
            if (!roomMetadata.has(roomId)) {
                roomMetadata.set(roomId, { guestCounter: 0 });
            }
            const metadata = roomMetadata.get(roomId);

            let safeName = (userName || '').trim().slice(0, 50);
            if (!safeName || safeName.toLowerCase() === 'guest') {
                metadata.guestCounter++;
                safeName = `Guest ${metadata.guestCounter}`;
            }

            socket.join(roomId);
            socketMeta.set(socket.id, { roomId, userName: safeName });
            console.log(`[WS] ${safeName} joined ${roomId}`);

            if (rooms.has(roomId) && rooms.get(roomId) instanceof Map) {
                socket.emit('init-room', Array.from(rooms.get(roomId).values()));
            } else if (!rooms.has(roomId)) {
                // Try loading from database first
                let loadedMap = null;
                if (state.loadRoomFromDb) {
                    try {
                        const { loadRoomFromDb } = require('./persistence');
                        loadedMap = await loadRoomFromDb(roomId);
                    } catch (e) {
                        // Persistence not available, continue with empty room
                    }
                }
                if (loadedMap && loadedMap.size > 0) {
                    rooms.set(roomId, loadedMap);
                    socket.emit('init-room', Array.from(loadedMap.values()));
                } else {
                    rooms.set(roomId, new Map());
                }
            }

            // Initialize room locks if needed
            if (!roomLocks.has(roomId)) {
                roomLocks.set(roomId, new Map());
            }

            // Send current lock state to incoming user
            const currentLocks = roomLocks.get(roomId);
            if (currentLocks && currentLocks.size > 0) {
                for (const [elementId, lock] of currentLocks) {
                    socket.emit('element-locked', {
                        elementId,
                        lockedBy: lock.socketId,
                        userName: lock.userName,
                        lockedAt: lock.lockedAt,
                    });
                }
            }

            emitUserCount(roomId);

            // Expire stale locks periodically on room activity
            expireStaleLocks(roomId);
        } catch (err) {
            console.error('[WS] join-room error:', err.message);
        }
    });

    socket.on('draw-element', ({ roomId, element }) => {
        try {
            if (!roomId || !element?.id) return;
            if (!isWithinRateLimit(socket.id)) return;

            if (!rooms.has(roomId)) rooms.set(roomId, new Map());
            rooms.get(roomId).set(element.id, element);

            // Mark room as dirty for persistence
            if (state.markRoomDirty) state.markRoomDirty(roomId);

            socket.to(roomId).emit('update-element', element);
        } catch (err) {
            console.error('[WS] draw-element error:', err.message);
        }
    });

    socket.on('erase-element', ({ roomId, elementId }) => {
        try {
            if (!roomId || !elementId) return;
            if (!isWithinRateLimit(socket.id)) return;

            if (rooms.has(roomId)) {
                rooms.get(roomId).delete(elementId);
                socket.to(roomId).emit('remove-element', elementId);

                // Mark room as dirty for persistence
                if (state.markRoomDirty) state.markRoomDirty(roomId);
            }

            // Release any lock on the erased element
            if (roomLocks.has(roomId)) {
                roomLocks.get(roomId).delete(elementId);
                io.to(roomId).emit('element-unlocked', elementId);
            }
        } catch (err) {
            console.error('[WS] erase-element error:', err.message);
        }
    });

    socket.on('clear-canvas', (roomId) => {
        try {
            if (!roomId) return;
            if (rooms.has(roomId)) {
                rooms.get(roomId).clear();
                socket.to(roomId).emit('canvas-cleared');

                if (state.markRoomDirty) state.markRoomDirty(roomId);
            }
            // Clear all locks
            if (roomLocks.has(roomId)) {
                roomLocks.get(roomId).clear();
            }
        } catch (err) {
            console.error('[WS] clear-canvas error:', err.message);
        }
    });

    // ── Element Locking (Phase 2) ──

    socket.on('lock-element', ({ roomId, elementId }) => {
        try {
            if (!roomId || !elementId) return;

            if (!roomLocks.has(roomId)) {
                roomLocks.set(roomId, new Map());
            }

            const locks = roomLocks.get(roomId);
            const existing = locks.get(elementId);

            // If already locked by someone else, reject
            if (existing && existing.socketId !== socket.id) {
                // Check if lock is stale
                if (Date.now() - existing.lockedAt > LOCK_EXPIRY_MS) {
                    locks.delete(elementId);
                } else {
                    socket.emit('lock-rejected', {
                        elementId,
                        lockedBy: existing.socketId,
                        userName: existing.userName,
                    });
                    return;
                }
            }

            const meta = socketMeta.get(socket.id);
            const lockData = {
                socketId: socket.id,
                userName: meta?.userName || 'Guest',
                lockedAt: Date.now(),
            };
            locks.set(elementId, lockData);

            io.to(roomId).emit('element-locked', {
                elementId,
                lockedBy: lockData.socketId,
                userName: lockData.userName,
                lockedAt: lockData.lockedAt,
            });
        } catch (err) {
            console.error('[WS] lock-element error:', err.message);
        }
    });

    socket.on('unlock-element', ({ roomId, elementId }) => {
        try {
            if (!roomId || !elementId) return;
            if (!roomLocks.has(roomId)) return;

            const locks = roomLocks.get(roomId);
            const lock = locks.get(elementId);

            // Only the locker can unlock
            if (lock && lock.socketId === socket.id) {
                locks.delete(elementId);
                io.to(roomId).emit('element-unlocked', elementId);
            }
        } catch (err) {
            console.error('[WS] unlock-element error:', err.message);
        }
    });

    socket.on('cursor-move', ({ roomId, user, x, y }) => {
        try {
            if (!roomId || !isWithinRateLimit(socket.id)) return;
            socket.to(roomId).emit('cursor-update', {
                socketId: socket.id, user, x, y,
            });
        } catch (err) {}
    });

    socket.on('kick-user', ({ roomCode, targetSocketId }) => {
        try {
            const kickerMeta = socketMeta.get(socket.id);
            if (!kickerMeta) return;

            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
                const targetMeta = socketMeta.get(targetSocketId);
                if (targetMeta && targetMeta.roomId === kickerMeta.roomId) {
                    targetSocket.emit('force-disconnect');
                    targetSocket.leave(kickerMeta.roomId);
                    targetSocket.disconnect(true);
                }
            }
        } catch (err) {
            console.error('[WS] kick-user error:', err.message);
        }
    });

    socket.on('chat-message', ({ roomId, message }) => {
        try {
            if (!roomId || !message || !isWithinRateLimit(socket.id)) return;
            
            const meta = socketMeta.get(socket.id);
            const senderName = meta?.userName || 'Guest';
            const text = String(message.text || '').trim().substring(0, 1000);
            if (!text) return;

            const chatPayload = {
                id: message.id || Date.now().toString(),
                socketId: socket.id,
                user: senderName,
                text,
                timestamp: message.timestamp || Date.now()
            };

            io.to(roomId).emit('chat-message', chatPayload);
        } catch (err) {
             console.error('[WS] chat-message error:', err.message);
        }
    });

    socket.on('disconnect', () => {
        const meta = socketMeta.get(socket.id);
        if (meta) {
            const { roomId } = meta;
            // Release all locks held by this socket
            releaseAllLocks(socket.id, roomId);
            socketMeta.delete(socket.id);
            socketRates.delete(socket.id);
            io.to(roomId).emit('cursor-remove', socket.id);
            emitUserCount(roomId);
        }
    });

    socket.on('error', (err) => {
        console.error(`[WS] Socket ${socket.id} error:`, err.message);
    });
};
