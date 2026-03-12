import { useEffect, useState, useCallback } from 'react';
import { useBoardStore, Element } from '@/store/useBoardStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getSocket } from '@/lib/socket';

interface CursorData {
    socketId: string;
    x: number;
    y: number;
    user: { name?: string } | null;
}

/**
 * Manages WebSocket connection for room sync — element CRUD, cursor sharing,
 * and active user tracking. Returns cursors state and room users.
 */
export function useSocketSync(roomId: string) {
    const { setElements, setSelectedElement } = useBoardStore();
    const { user } = useAuthStore();
    const [cursors, setCursors] = useState<Record<string, CursorData>>({});
    const [roomUsers, setRoomUsers] = useState<{ count: number; users: { socketId: string; name: string }[] }>({ count: 0, users: [] });

    useEffect(() => {
        const socket = getSocket();
        socket.connect();

        socket.emit('join-room', { roomId, userName: user?.name || 'Guest' });

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

        return () => {
            socket.disconnect();
            socket.off('init-room');
            socket.off('update-element');
            socket.off('remove-element');
            socket.off('canvas-cleared');
            socket.off('cursor-update');
            socket.off('cursor-remove');
            socket.off('room-users');
        };
    }, [roomId, setElements, setSelectedElement, user]);

    /** Emit cursor position to other clients */
    const emitCursor = useCallback((x: number, y: number) => {
        const { user } = useAuthStore.getState();
        if (user) {
            getSocket().emit('cursor-move', { roomId, user, x, y });
        }
    }, [roomId]);

    return { cursors, roomUsers, emitCursor };
}
