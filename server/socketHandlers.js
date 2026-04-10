const MAX_EVENTS_PER_SECOND = 120;
const RATE_WINDOW_MS = 1000;
const LOCK_EXPIRY_MS = 30000; // Auto-expire stale locks after 30 seconds

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e2b';

const chatHistoryMap = new Map(); // Global AI conversational memory per room

const AI_SYSTEM_PROMPT = `You are OmniBoard AI, a helpful assistant embedded in a real-time collaborative whiteboard application. You help users brainstorm, plan, organize ideas, and answer questions. Keep responses concise and practical. Use markdown formatting when helpful. You're friendly, creative, and focused on helping teams collaborate better.
IMPORTANT CAPABILITY: You can draw elements directly on the whiteboard if the user asks you to!
Whenever the user asks you to draw something, you MUST first reply conversationally to acknowledge what you are drawing (e.g., "I've added a blue circle to the board for you!").
THEN, append a MINIMAL raw JSON array block at the very end of your response inside triple backticks like this:
\`\`\`json
[{"type":"rectangle","color":"#e74c3c","width":200,"height":200}]
\`\`\`
Valid types are: "rectangle", "ellipse", "diamond", "text", "sticky".
Omit coordinates to auto-center them. Keep the JSON perfectly compact on one line to maximize your generation speed!`;

/**
 * registerHandlers — Binds all WebSocket event listeners to a specific socket.
 * Modularizes server logic and keeps index.js focused on startup.
 * Phase 2: Added element-level locking to prevent concurrent edit conflicts.
 * Phase 3: Added role-based permissions and AI chatbot integration.
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
                    users.push({ socketId: sid, name: meta.userName || 'Guest', role: meta.role || 'editor' });
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

    /** Check if socket has write permission (leader or editor) */
    function canWrite(socketId) {
        const meta = socketMeta.get(socketId);
        if (!meta) return false;
        return meta.role === 'leader' || meta.role === 'editor';
    }

    /** Check if socket is the room leader */
    function isLeader(socketId) {
        const meta = socketMeta.get(socketId);
        return meta?.role === 'leader';
    }

    // --- Events ---

    socket.on('join-room', async ({ roomId, userName, role }) => {
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

            const safeRole = ['leader', 'editor', 'viewer'].includes(role) ? role : 'editor';

            socket.join(roomId);
            socketMeta.set(socket.id, { roomId, userName: safeName, role: safeRole });
            console.log(`[WS] ${safeName} (${safeRole}) joined ${roomId}`);

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

            // Permission check: must be editor or leader
            if (!canWrite(socket.id)) {
                socket.emit('permission-denied', { action: 'draw', message: 'You do not have write permission in this room.' });
                return;
            }

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

            // Permission check: must be editor or leader
            if (!canWrite(socket.id)) {
                socket.emit('permission-denied', { action: 'erase', message: 'You do not have write permission in this room.' });
                return;
            }

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

            // Permission check: only leader can clear
            if (!isLeader(socket.id)) {
                socket.emit('permission-denied', { action: 'clear', message: 'Only the room leader can clear the canvas.' });
                return;
            }

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
            // Only leader can kick
            if (!isLeader(socket.id)) {
                socket.emit('permission-denied', { action: 'kick', message: 'Only the room leader can kick users.' });
                return;
            }

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

    // ── Role Updates ──

    socket.on('update-user-role', ({ roomId, targetSocketId, newRole }) => {
        try {
            if (!isLeader(socket.id)) {
                socket.emit('permission-denied', { action: 'update-role', message: 'Only the room leader can change roles.' });
                return;
            }

            const targetMeta = socketMeta.get(targetSocketId);
            if (!targetMeta || targetMeta.roomId !== roomId) return;

            // Update the role in socket meta
            targetMeta.role = newRole;
            socketMeta.set(targetSocketId, targetMeta);

            // Notify the target user their role changed
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
                targetSocket.emit('role-updated', { newRole });
            }

            // Update room users list for everyone
            emitUserCount(roomId);
        } catch (err) {
            console.error('[WS] update-user-role error:', err.message);
        }
    });

    socket.on('transfer-leadership', ({ roomId, targetSocketId }) => {
        try {
            if (!isLeader(socket.id)) {
                socket.emit('permission-denied', { action: 'transfer', message: 'Only the room leader can transfer leadership.' });
                return;
            }

            const myMeta = socketMeta.get(socket.id);
            const targetMeta = socketMeta.get(targetSocketId);
            if (!myMeta || !targetMeta || targetMeta.roomId !== roomId) return;

            // Swap roles
            myMeta.role = 'editor';
            targetMeta.role = 'leader';
            socketMeta.set(socket.id, myMeta);
            socketMeta.set(targetSocketId, targetMeta);

            // Notify both users
            socket.emit('role-updated', { newRole: 'editor' });
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) {
                targetSocket.emit('role-updated', { newRole: 'leader' });
            }

            // Update room users list for everyone
            emitUserCount(roomId);
        } catch (err) {
            console.error('[WS] transfer-leadership error:', err.message);
        }
    });

    // ── Chat Messages ──

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

            // Broadcast the user's message to everyone
            io.to(roomId).emit('chat-message', chatPayload);

            // Check for @ai trigger
            if (text.toLowerCase().startsWith('@ai ')) {
                const aiQuery = text.slice(4).trim();
                if (aiQuery) {
                    handleAiQuery(roomId, aiQuery, senderName);
                }
            }
        } catch (err) {
             console.error('[WS] chat-message error:', err.message);
        }
    });

    // ── AI Chat Integration (Ollama) ──

    async function handleAiQuery(roomId, query, senderName) {
        const aiMessageId = `ai-${Date.now()}`;

        try {
            // Notify room that AI is thinking
            io.to(roomId).emit('ai-response-start', { id: aiMessageId });

            // 1. Compile Live Canvas Map
            const elementsArray = Array.from(rooms.get(roomId)?.values() || []);
            const safeElements = elementsArray.slice(-50); // limit to 50 items
            let boardContext = "\n\n--- CURRENT BOARD STATE (" + safeElements.length + " items) ---\n";
            if (safeElements.length === 0) {
                boardContext += "The board is currently EMPTY.\n";
            } else {
                safeElements.forEach((el, index) => {
                    const x = Math.round(el.x1 || 0);
                    const y = Math.round(el.y1 || 0);
                    const t = el.text ? ` text: "${el.text}"` : '';
                    boardContext += `ID ${index+1}: A ${el.color} ${el.type} at (x:${x}, y:${y})${t}\n`;
                });
            }
            boardContext += "Because you know the exact coordinates of existing items, you MUST offset your new generated shapes mathematically so they do not overlap existing elements unless requested.";
            
            // 2. Fetch Chat History
            if (!chatHistoryMap.has(roomId)) chatHistoryMap.set(roomId, []);
            const history = chatHistoryMap.get(roomId);
            
            // 3. User message
            const userMsg = { role: 'user', content: `${senderName} asks (with board context secretly provided): ${query}` };

            const response = await fetch(`${OLLAMA_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    messages: [
                        { role: 'system', content: AI_SYSTEM_PROMPT + boardContext },
                        ...history,
                        userMsg
                    ],
                    stream: true,
                }),
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => 'Unknown error');
                io.to(roomId).emit('ai-response-error', {
                    id: aiMessageId,
                    error: `Ollama returned ${response.status}: ${errText.slice(0, 200)}`
                });
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullAiResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        if (json.message?.content) {
                            fullAiResponse += json.message.content;
                            io.to(roomId).emit('ai-response-chunk', {
                                id: aiMessageId,
                                token: json.message.content,
                            });
                        }
                        if (json.done) {
                            io.to(roomId).emit('ai-response-end', { id: aiMessageId });
                            
                            if (fullAiResponse.trim()) {
                                const hist = chatHistoryMap.get(roomId) || [];
                                hist.push({ role: 'user', content: `${senderName} asks: ${query}` }); // store without context dump
                                hist.push({ role: 'assistant', content: fullAiResponse });
                                if (hist.length > 20) chatHistoryMap.set(roomId, hist.slice(hist.length - 20));
                            }

                            processAiActions(roomId, fullAiResponse, io, state);
                            return;
                        }
                    } catch (parseErr) {
                        // Skip malformed JSON lines
                    }
                }
            }

            // If we exit the loop without a done signal
            io.to(roomId).emit('ai-response-end', { id: aiMessageId });

            if (fullAiResponse.trim()) {
                const hist = chatHistoryMap.get(roomId) || [];
                hist.push({ role: 'user', content: `${senderName} asks: ${query}` });
                hist.push({ role: 'assistant', content: fullAiResponse });
                if (hist.length > 20) chatHistoryMap.set(roomId, hist.slice(hist.length - 20));
            }

            processAiActions(roomId, fullAiResponse, io, state);

        } catch (err) {
            console.error('[WS] AI query error:', err.message);
            io.to(roomId).emit('ai-response-error', {
                id: aiMessageId,
                error: `AI is unavailable. Make sure Ollama is running on ${OLLAMA_URL}. Error: ${err.message}`
            });
        }
    }

    function processAiActions(roomId, fullText, io, state) {
        try {
            const jsonRegex = /```json\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/g;
            let match;
            while ((match = jsonRegex.exec(fullText)) !== null) {
                let elements = [];
                try {
                    const parsed = JSON.parse(match[1]);
                    if (Array.isArray(parsed)) elements = parsed;
                    else if (parsed.elements && Array.isArray(parsed.elements)) elements = parsed.elements;
                } catch(e) { continue; }

                if (elements.length > 0) {
                    elements.forEach(el => {
                        let type = el.type;
                        if (type === 'circle') type = 'ellipse';

                        let width = el.width || 150;
                        let height = el.height || 100;
                        let x = el.x !== undefined ? el.x : 0;
                        let y = el.y !== undefined ? el.y : 0;

                        // Sprinkle a random offset to prevent perfect overlap if stacking at 0,0
                        if (x === 0 && y === 0) {
                            x += (Math.random() * 80 - 40);
                            y += (Math.random() * 80 - 40);
                        }

                        const newElement = {
                            id: 'ai-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5),
                            type: type,
                            x1: x,
                            y1: y,
                            x2: x + width,
                            y2: y + height,
                            color: el.color || '#2c3e50',
                            strokeWidth: 2,
                            text: el.text || '',
                        };

                        if (el.type === 'sticky') {
                            newElement.stickyColor = el.color || '#f1c40f';
                        }
                        
                        if (!state.rooms.has(roomId)) state.rooms.set(roomId, new Map());
                        state.rooms.get(roomId).set(newElement.id, newElement);

                        if (state.markRoomDirty) state.markRoomDirty(roomId);

                        io.to(roomId).emit('update-element', newElement);
                    });
                }
            }
        } catch (e) {
            console.error('[WS] Failed to parse AI action:', e.message);
        }
    }

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
