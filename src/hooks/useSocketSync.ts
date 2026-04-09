import { useEffect, useState, useCallback } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getSocket } from '@/lib/socket';
import { Element, CursorData, ElementLock, RoomRole } from '@/types';

/**
 * Manages WebSocket connection for room sync — element CRUD, cursor sharing,
 * active user tracking, element-level locking, role management, and AI chat events.
 * Returns cursors state, room users, lock state, role, and emitCursor.
 */
export function useSocketSync(roomId: string, enabled: boolean = true, initialRole: RoomRole = 'editor') {
    const { setElements, setSelectedElement } = useBoardStore();
    const { user } = useAuthStore();
    const [cursors, setCursors] = useState<Record<string, CursorData>>({});
    const [roomUsers, setRoomUsers] = useState<{ count: number; users: { socketId: string; name: string; role?: RoomRole }[] }>({ count: 0, users: [] });
    const [lockedElements, setLockedElements] = useState<Record<string, ElementLock>>({});
    const [myRole, setMyRole] = useState<RoomRole>(initialRole);
    const [permissionDenied, setPermissionDenied] = useState<string | null>(null);

    // Sync initial role when it changes (e.g., after verify completes)
    useEffect(() => {
        setMyRole(initialRole);
    }, [initialRole]);

    useEffect(() => {
        if (!enabled || !roomId) return;

        const socket = getSocket();

        const joinRoom = () => {
            socket.emit('join-room', { roomId, userName: user?.name || 'Guest', role: myRole });
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

        socket.on('room-users', (data: { count: number; users: { socketId: string; name: string; role?: RoomRole }[] }) => {
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
            console.log(`[Lock] Element ${elementId} is locked by ${userName}`);
        });

        // ── Permission Events ──

        socket.on('permission-denied', ({ message }: { action: string; message: string }) => {
            setPermissionDenied(message);
            // Auto-clear after 3 seconds
            setTimeout(() => setPermissionDenied(null), 3000);
        });

        socket.on('role-updated', ({ newRole }: { newRole: RoomRole }) => {
            setMyRole(newRole);
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
            socket.off('permission-denied');
            socket.off('role-updated');
        };
    }, [roomId, enabled, setElements, setSelectedElement, user, myRole]);

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

    return { cursors, roomUsers, emitCursor, lockedElements, myRole, permissionDenied };
}
