import { Drawable } from 'roughjs/bin/core';

export type Tool = 'select' | 'rectangle' | 'ellipse' | 'diamond' | 'star' | 'sticky' | 'line' | 'arrow' | 'pencil' | 'text' | 'eraser' | 'image' | 'connector';

export type Point = { x: number; y: number; pressure?: number };

export type AnchorSide = 'center' | 'top' | 'bottom' | 'left' | 'right';

export interface ConnectionEndpoint {
    elementId: string;
    anchor: AnchorSide;
}

export interface Element {
    id: string;
    type: Tool;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    strokeWidth: number;
    text?: string;
    roughElement?: Drawable;        // Cache the rough.js shape
    points?: Point[];               // Store points for perfect-freehand

    // Image element fields
    imageDataUrl?: string;
    imageWidth?: number;
    imageHeight?: number;

    // Connector element fields
    connectedFrom?: ConnectionEndpoint;
    connectedTo?: ConnectionEndpoint;

    // Enhanced sticky note fields
    stickyColor?: string;
}

export interface ElementLock {
    elementId: string;
    lockedBy: string;       // socketId
    userName: string;
    lockedAt: number;
}

export interface User {
    name: string;
    email: string;
}

export interface CursorData {
    socketId: string;
    x: number;
    y: number;
    user: { name?: string } | null;
}

export interface ChatMessage {
    id: string;
    socketId: string;
    user: string;
    text: string;
    timestamp: number;
}

export interface RoomUsers {
    count: number;
    users: { socketId: string; name: string }[];
}
