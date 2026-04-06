'use client';

import { useBoardStore } from '@/store/useBoardStore';
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useDrawingHandlers } from '@/hooks/useDrawingHandlers';
import { motion, AnimatePresence } from 'framer-motion';

import { CursorData, ElementLock } from '@/types';

/**
 * Board — the main collaborative canvas component.
 * Composes hooks for socket sync, rendering, keyboard shortcuts, and drawing handlers.
 * This component only handles layout and JSX — all logic lives in hooks.
 */
interface BoardProps {
    roomCode: string;
    cursors: Record<string, CursorData>;
    emitCursor: (x: number, y: number) => void;
    lockedElements?: Record<string, ElementLock>;
}

export default function Board({ roomCode, cursors, emitCursor, lockedElements = {} }: BoardProps) {
    const { panOffset, zoom, currentColor } = useBoardStore();

    // Canvas rendering — grid, elements, selection, handles, lock indicators
    useCanvasRenderer({ lockedElements });

    // Keyboard shortcuts — undo/redo, delete, tool switching
    useKeyboardShortcuts(roomCode);

    // Drawing handlers — pointer events, text input, cursor style, image drop, connectors
    const {
        handlePointerDown, handlePointerMove, handlePointerUp,
        handleWheel, handleClick, handleDoubleClick, handleTextBlur,
        handleDragOver, handleDrop,
        getCursorStyle, writingPosition,
    } = useDrawingHandlers(roomCode, emitCursor, { lockedElements });

    return (
        <div className="w-full h-full relative">
            <canvas
                id="canvas"
                className="w-full h-full bg-theme-lightest touch-none block"
                style={{ cursor: getCursorStyle() }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onWheel={handleWheel}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            />

            {/* Text input overlay (for text tool and sticky note editing) */}
            {writingPosition && (
                <textarea
                    autoFocus
                    className="absolute m-0 p-0 border-0 outline-none bg-transparent whitespace-pre overflow-hidden resize-none"
                    style={{
                        left: `${writingPosition.x * zoom + panOffset.x}px`,
                        top: `${(writingPosition.y - 28) * zoom + panOffset.y}px`,
                        font: `${28 * zoom}px "Kalam", cursive`,
                        color: currentColor,
                        lineHeight: 1,
                    }}
                    onBlur={handleTextBlur}
                />
            )}

            {/* Live Cursors Overlay */}
            <AnimatePresence>
                {Object.values(cursors).map(cursor => (
                    <motion.div
                        key={cursor.socketId}
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: 1,
                            x: cursor.x * zoom + panOffset.x,
                            y: cursor.y * zoom + panOffset.y,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "tween", ease: "linear", duration: 0.1 }}
                        className="absolute top-0 left-0 pointer-events-none z-40 flex flex-col items-start"
                    >
                        <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                            <path d="M5.65376 2.15376C5.40539 1.55169 4.59461 1.55168 4.34624 2.15376L0.264426 12.046C0.0305603 12.613 0.449195 13.2384 1.05602 13.2384H3V17.5C3 18.3284 3.67157 19 4.5 19H5.5C6.32843 19 7 18.3284 7 17.5V13.2384H8.94398C9.55081 13.2384 9.96944 12.613 9.73557 12.046L5.65376 2.15376Z" fill="#A6B1E1" stroke="white" strokeWidth="1.5" />
                        </svg>
                        <div className="bg-theme-accent text-white text-xs font-bold px-2 py-0.5 rounded-br-lg rounded-bl-lg rounded-tr-lg shadow-sm whitespace-nowrap -mt-2 ml-4">
                            {cursor.user?.name || 'Guest'}
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
