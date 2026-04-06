import { useEffect, useState, useCallback } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getSocket } from '@/lib/socket';
import { Element, CursorData, ElementLock } from '@/types';

/**
 * Manages WebSocket connection for room sync — element CRUD, cursor sharing,
 * active user tracking, and element-level locking.
 * Returns cursors state, room users, lock state, and emitCursor.
 */
export function useSocketSync(roomId: string, enabled: boolean = true) {
    const { setElements, setSelectedElement } = useBoardStore();
    const { user } = useAuthStore();
    const [cursors, setCursors] = useState<Record<string, CursorData>>({});
    const [roomUsers, setRoomUsers] = useState<{ count: number; users: { socketId: string; name: string }[] }>({ count: 0, users: [] });
    const [lockedElements, setLockedElements] = useState<Record<string, ElementLock>>({});

    useEffect(() => {
        if (!enabled || !roomId) return;

        const socket = getSocket();

        const joinRoom = () => {
            socket.emit('join-room', { roomId, userName: user?.name || 'Guest' });
        };

        socket.on('connect', joinRoom);
        
        if (socket.connected) {
            joinRoom();
        } else {
            socket.connect();
        }

        socket.on('init-room', (serverElements: Element[]) => {
            setElements(serverElements);
        });

        socket.on('update-element', (element: Element) => {
            setElements((prev) => {
                const index = prev.findIndex(el => el.id === element.id);
                if (index !== -1) {
                    const newElements = [...prev];
                    newElements[index] = element;
                    return newElements;
                }
                return [...prev, element];
            }, true);
        });

        socket.on('remove-element', (elementId: string) => {
            setElements((prev) => prev.filter(el => el.id !== elementId), true);
            if (useBoardStore.getState().selectedElement?.id === elementId) {
                setSelectedElement(null);
            }
        });

        socket.on('canvas-cleared', () => {
            setElements([], true);
            setSelectedElement(null);
            setLockedElements({});
        });

        socket.on('cursor-update', (data: CursorData) => {
            setCursors(prev => ({ ...prev, [data.socketId]: data }));
        });

        socket.on('cursor-remove', (socketId: string) => {
            setCursors(prev => {
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
        });

        socket.on('room-users', (data: { count: number; users: { socketId: string; name: string }[] }) => {
            setRoomUsers(data);
        });

        // ── Element Locking (Phase 2) ──

        socket.on('element-locked', (lock: ElementLock) => {
            setLockedElements(prev => ({
                ...prev,
                [lock.elementId]: lock,
            }));
        });

        socket.on('element-unlocked', (elementId: string) => {
            setLockedElements(prev => {
                const next = { ...prev };
                delete next[elementId];
                return next;
            });
        });

        socket.on('lock-rejected', ({ elementId, userName }: { elementId: string; userName: string }) => {
            // Show a non-intrusive notification
            console.log(`[Lock] Element ${elementId} is locked by ${userName}`);
        });

        return () => {
            socket.disconnect();
            socket.off('connect', joinRoom);
            socket.off('init-room');
            socket.off('update-element');
            socket.off('remove-element');
            socket.off('canvas-cleared');
            socket.off('cursor-update');
            socket.off('cursor-remove');
            socket.off('room-users');
            socket.off('element-locked');
            socket.off('element-unlocked');
            socket.off('lock-rejected');
        };
    }, [roomId, enabled, setElements, setSelectedElement, user]);

    /** Emit cursor position to other clients */
    const emitCursor = useCallback((x: number, y: number) => {
        const { user: authUser } = useAuthStore.getState();
        getSocket().emit('cursor-move', { 
            roomId, 
            user: authUser || { name: 'Guest' }, 
            x, 
            y 
        });
    }, [roomId]);

    return { cursors, roomUsers, emitCursor, lockedElements };
}
