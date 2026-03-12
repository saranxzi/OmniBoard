'use client';

import {
    MousePointer2, Pencil, Square, Circle, Diamond, Minus, MoveRight,
    Type, Eraser, Undo2, Redo2, Trash2, ZoomIn, ZoomOut, Maximize, ImageDown
} from 'lucide-react';
import { useBoardStore, Tool, MIN_ZOOM, MAX_ZOOM } from '@/store/useBoardStore';
import { getSocket } from '@/lib/socket';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const TOOLS: { type: Tool; icon: React.ElementType; label: string }[] = [
    { type: 'select', icon: MousePointer2, label: 'Select (V)' },
    { type: 'pencil', icon: Pencil, label: 'Pencil (P)' },
    { type: 'line', icon: Minus, label: 'Line (L)' },
    { type: 'arrow', icon: MoveRight, label: 'Arrow (A)' },
    { type: 'rectangle', icon: Square, label: 'Rectangle (R)' },
    { type: 'ellipse', icon: Circle, label: 'Ellipse (O)' },
    { type: 'diamond', icon: Diamond, label: 'Diamond (D)' },
    { type: 'text', icon: Type, label: 'Text (T)' },
    { type: 'eraser', icon: Eraser, label: 'Eraser (E)' },
];

const COLORS = [
    { name: 'Dark', value: '#424874' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Purple', value: '#a855f7' },
];

const STROKE_WIDTHS = [
    { name: 'Thin', value: 2 },
    { name: 'Medium', value: 4 },
    { name: 'Bold', value: 8 },
];

export default function Toolbar() {
    const {
        activeTool, setActiveTool,
        currentColor, setCurrentColor,
        currentStrokeWidth, setCurrentStrokeWidth,
        undo, redo, historyIndex, history, clearCanvas,
        zoom, setZoom, setPanOffset
    } = useBoardStore();

    const params = useParams();
    const roomId = params.roomId as string;

    const handleExport = () => {
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#F4EEFF';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        ctx.drawImage(canvas, 0, 0);
        const link = document.createElement('a');
        link.download = 'omniboard-export.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    };

    const isDrawingTool = activeTool !== 'select' && activeTool !== 'eraser';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            transition={{ duration: 0.4 }}
            className="fixed bottom-6 left-1/2 z-50 flex flex-col items-center gap-2.5 w-fit"
        >
            {/* Colors & Stroke — shown only for drawing tools */}
            <AnimatePresence>
                {isDrawingTool && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl shadow-theme-dark/10 border border-theme-light p-2 flex items-center gap-3 transition-colors duration-300"
                    >
                        {/* Colors */}
                        <div className="flex items-center gap-1.5">
                            {COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    onClick={() => setCurrentColor(color.value)}
                                    className={`w-6 h-6 rounded-full border-2 transition-all ${currentColor === color.value
                                        ? 'scale-110 border-theme-accent shadow-md shadow-theme-accent/30'
                                        : 'border-transparent hover:scale-105 hover:border-theme-light'
                                    }`}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                />
                            ))}
                        </div>

                        <div className="w-px h-6 bg-theme-light" />

                        {/* Stroke Widths */}
                        <div className="flex items-center gap-1">
                            {STROKE_WIDTHS.map((width) => (
                                <button
                                    key={width.value}
                                    onClick={() => setCurrentStrokeWidth(width.value)}
                                    className={`w-7 h-7 flex items-center justify-center transition-all rounded-full ${currentStrokeWidth === width.value
                                        ? 'bg-theme-light shadow-sm'
                                        : 'hover:bg-theme-lightest'
                                    }`}
                                    title={width.name}
                                >
                                    <div
                                        className="bg-theme-dark rounded-full"
                                        style={{ width: '16px', height: `${width.value}px` }}
                                    />
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Toolbar */}
            <div className="bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl shadow-theme-dark/10 border border-theme-light p-1.5 flex items-center gap-0.5 transition-colors duration-300">
                {/* Undo / Redo */}
                <button
                    onClick={undo}
                    disabled={historyIndex === 0}
                    className="p-2.5 rounded-xl text-theme-dark/50 hover:bg-theme-lightest hover:text-theme-dark disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 className="w-[18px] h-[18px]" />
                </button>
                <button
                    onClick={redo}
                    disabled={historyIndex === history.length - 1}
                    className="p-2.5 rounded-xl text-theme-dark/50 hover:bg-theme-lightest hover:text-theme-dark disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo2 className="w-[18px] h-[18px]" />
                </button>

                <div className="w-px h-7 bg-theme-light mx-1" />

                {/* Drawing Tools */}
                {TOOLS.map((tool) => (
                    <button
                        key={tool.type}
                        onClick={() => setActiveTool(tool.type)}
                        className={`relative p-2.5 rounded-xl transition-all ${activeTool === tool.type
                            ? 'text-theme-dark'
                            : 'text-theme-dark/50 hover:bg-theme-lightest hover:text-theme-dark'
                        }`}
                        title={tool.label}
                    >
                        {activeTool === tool.type && (
                            <motion.div
                                layoutId="activeToolBg"
                                className="absolute inset-0 bg-theme-light rounded-xl shadow-sm border border-theme-light"
                                initial={false}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        )}
                        <tool.icon className="w-[18px] h-[18px] relative z-10" />
                    </button>
                ))}

                <div className="w-px h-7 bg-theme-light mx-1" />

                {/* Zoom */}
                <button
                    onClick={() => setZoom((prev) => Math.max(prev - 0.1, MIN_ZOOM))}
                    disabled={zoom <= MIN_ZOOM}
                    className="p-2.5 rounded-xl text-theme-dark/50 hover:bg-theme-lightest hover:text-theme-dark disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    title="Zoom Out"
                >
                    <ZoomOut className="w-[18px] h-[18px]" />
                </button>
                <button
                    onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
                    className="text-[11px] font-bold text-theme-dark/60 w-10 text-center select-none font-mono tracking-wide hover:text-theme-dark transition-colors"
                    title="Reset Zoom & Pan"
                >
                    {Math.round(zoom * 100)}%
                </button>
                <button
                    onClick={() => setZoom((prev) => Math.min(prev + 0.1, MAX_ZOOM))}
                    disabled={zoom >= MAX_ZOOM}
                    className="p-2.5 rounded-xl text-theme-dark/50 hover:bg-theme-lightest hover:text-theme-dark disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    title="Zoom In"
                >
                    <ZoomIn className="w-[18px] h-[18px]" />
                </button>

                <div className="w-px h-7 bg-theme-light mx-1" />

                {/* Export */}
                <button
                    onClick={handleExport}
                    className="p-2.5 rounded-xl text-theme-dark/50 hover:bg-theme-lightest hover:text-theme-dark transition-all"
                    title="Export as PNG"
                >
                    <ImageDown className="w-[18px] h-[18px]" />
                </button>

                {/* Trash */}
                <button
                    onClick={() => {
                        if (window.confirm('Clear the entire canvas?')) {
                            clearCanvas();
                            getSocket().emit('clear-canvas', roomId);
                        }
                    }}
                    className="p-2.5 rounded-xl text-theme-dark/50 hover:bg-red-50 hover:text-red-500 transition-all"
                    title="Clear Canvas"
                >
                    <Trash2 className="w-[18px] h-[18px]" />
                </button>
            </div>
        </motion.div>
    );
}
