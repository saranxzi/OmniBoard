/**
 * persistence.js — Server-side canvas persistence layer.
 * Periodically saves dirty rooms to the database and loads rooms from DB on join.
 * Uses Prisma Client for SQLite/PostgreSQL operations.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const SAVE_INTERVAL_MS = 30000; // Save every 30 seconds
const dirtyRooms = new Set();

/**
 * Mark a room as dirty (needing persistence).
 * Called by socketHandlers on every draw/erase event.
 */
function markRoomDirty(roomId) {
    dirtyRooms.add(roomId);
}

/**
 * Save all elements for a room to the database.
 * Uses upsert pattern — creates or updates each element.
 */
async function saveRoomToDb(roomId, elementsMap) {
    if (!elementsMap || elementsMap.size === 0) return;

    try {
        // First, find if this room exists in DB by code
        const room = await prisma.room.findFirst({
            where: { 
                OR: [
                    { code: roomId },
                    { id: roomId }
                ]
            }
        });

        if (!room) {
            console.log(`[Persistence] Room ${roomId} not found in DB, skipping save`);
            return;
        }

        const dbRoomId = room.id;
        const elements = Array.from(elementsMap.values());

        // Delete elements that no longer exist on the server
        const currentIds = elements.map(el => el.id);
        await prisma.boardElement.deleteMany({
            where: {
                roomId: dbRoomId,
                NOT: { id: { in: currentIds } }
            }
        });

        // Batch upsert all current elements
        const operations = elements.map(element => {
            // Strip non-serializable fields (roughElement contains canvas-specific objects)
            const sanitized = { ...element };
            delete sanitized.roughElement;
            
            return prisma.boardElement.upsert({
                where: { id: element.id },
                create: {
                    id: element.id,
                    roomId: dbRoomId,
                    type: element.type,
                    data: JSON.stringify(sanitized),
                },
                update: {
                    type: element.type,
                    data: JSON.stringify(sanitized),
                }
            });
        });

        await prisma.$transaction(operations);
        console.log(`[Persistence] ✅ Saved ${elements.length} elements for room ${roomId}`);
    } catch (err) {
        console.error(`[Persistence] ❌ Failed to save room ${roomId}:`, err.message);
    }
}

/**
 * Load all elements for a room from the database.
 * Returns a Map<elementId, Element> or null if room not found.
 */
async function loadRoomFromDb(roomId) {
    try {
        const room = await prisma.room.findFirst({
            where: { 
                OR: [
                    { code: roomId },
                    { id: roomId }
                ]
            }
        });

        if (!room) return null;

        const dbElements = await prisma.boardElement.findMany({
            where: { roomId: room.id }
        });

        if (dbElements.length === 0) return null;

        const elementsMap = new Map();
        for (const dbEl of dbElements) {
            try {
                const element = JSON.parse(dbEl.data);
                elementsMap.set(element.id, element);
            } catch {
                console.warn(`[Persistence] Skipping corrupt element ${dbEl.id}`);
            }
        }

        console.log(`[Persistence] 📦 Loaded ${elementsMap.size} elements for room ${roomId}`);
        return elementsMap;
    } catch (err) {
        console.error(`[Persistence] ❌ Failed to load room ${roomId}:`, err.message);
        return null;
    }
}

/**
 * Start the periodic save loop.
 * @param rooms - The shared rooms Map from the server state
 */
function startSaveLoop(rooms) {
    setInterval(async () => {
        if (dirtyRooms.size === 0) return;

        const toSave = [...dirtyRooms];
        dirtyRooms.clear();

        for (const roomId of toSave) {
            const elementsMap = rooms.get(roomId);
            if (elementsMap) {
                await saveRoomToDb(roomId, elementsMap);
            }
        }
    }, SAVE_INTERVAL_MS);

    console.log(`[Persistence] 🔄 Save loop started (interval: ${SAVE_INTERVAL_MS / 1000}s)`);
}

/**
 * Flush a specific room to DB (used during GC before purging from RAM).
 */
async function flushRoom(roomId, elementsMap) {
    if (elementsMap && elementsMap.size > 0) {
        await saveRoomToDb(roomId, elementsMap);
    }
    dirtyRooms.delete(roomId);
}

module.exports = {
    markRoomDirty,
    saveRoomToDb,
    loadRoomFromDb,
    startSaveLoop,
    flushRoom,
    prisma,
};
