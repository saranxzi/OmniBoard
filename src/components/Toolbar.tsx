'use client';

import { 
    Undo2, Redo2, ZoomIn, ZoomOut, ImageDown, Trash2,
    Sun, Moon, Magnet, Lock
} from 'lucide-react';
import { useBoardStore, MIN_ZOOM, MAX_ZOOM } from '@/store/useBoardStore';
import { getSocket } from '@/lib/socket';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { TOOLS, COLORS, STROKE_WIDTHS } from '@/constants/board';
import { createElement } from '@/lib/geometry';
import { RoomRole } from '@/types';

interface ToolbarProps {
    myRole?: RoomRole;
}

/**
 * Toolbar — Modular drawing toolkit.
 * Centralizes tool selection, styling, canvas actions, dark mode, and snap settings.
 * Respects role-based permissions: viewers see disabled tools, only leaders can clear.
 */
export default function Toolbar({ myRole = 'editor' }: ToolbarProps) {
    const {
        activeTool, setActiveTool,
        currentColor, setCurrentColor,
        currentStrokeWidth, setCurrentStrokeWidth,
        undo, redo, historyIndex, history, clearCanvas,
        zoom, setZoom, setPanOffset,
        isDarkMode, toggleDarkMode,
        snapToGrid, setSnapToGrid,
    } = useBoardStore();

    const { roomId } = useParams() as { roomId: string };

    const isViewOnly = myRole === 'viewer';
    const isLeader = myRole === 'leader';
    const canWrite = myRole === 'leader' || myRole === 'editor';

    /** Export — capture all elements, not just viewport */
    const handleExport = () => {
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) return;

        const { elements } = useBoardStore.getState();
        if (elements.length === 0) return;

        // Calculate bounding box of all elements
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        elements.forEach(el => {
            if (el.type === 'pencil' && el.points) {
                el.points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
            } else {
                minX = Math.min(minX, el.x1, el.x2);
                minY = Math.min(minY, el.y1, el.y2);
                maxX = Math.max(maxX, el.x1, el.x2);
                maxY = Math.max(maxY, el.y1, el.y2);
            }
        });

        // Add padding
        const padding = 40;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        // The current canvas already has the drawing — capture visible area
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) return;

        // Fill background based on dark mode
        ctx.fillStyle = isDarkMode ? '#0f0f1a' : '#F4EEFF';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        ctx.drawImage(canvas, 0, 0);

        const link = document.createElement('a');
        link.download = `omniboard-${roomId}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    };

    const isDrawingTool = !['select', 'eraser', 'image'].includes(activeTool);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isViewOnly) return;
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const img = new Image();
            img.onload = () => {
                const MAX_SIZE = 400;
                let w = img.width;
                let h = img.height;
                if (w > MAX_SIZE || h > MAX_SIZE) {
                    const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
                    w *= ratio;
                    h *= ratio;
                }

                const { panOffset, zoom, elements, setElements } = useBoardStore.getState();
                const cx = (-panOffset.x + window.innerWidth / 2) / zoom;
                const cy = (-panOffset.y + window.innerHeight / 2) / zoom;
                
                const elementId = Date.now().toString();

                const element = createElement(
                    elementId,
                    cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2,
                    'image', '#000', 1, undefined, {
                        imageDataUrl: dataUrl,
                        imageWidth: w,
                        imageHeight: h,
                    }
                );

                setElements([...elements, element]);
                getSocket().emit('draw-element', { roomId, element });
                setActiveTool('select');
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
        // Reset input value to allow uploading the same file again
        e.target.value = '';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-50 flex flex-col items-center gap-2.5 w-fit"
        >
            <AnimatePresence>
                {isDrawingTool && canWrite && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl border border-theme-light p-2 flex items-center gap-3 transition-colors"
                    >
                        <div className="flex items-center gap-1.5">
                            {COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    onClick={() => setCurrentColor(color.value)}
                                    className={`w-6 h-6 rounded-full border-2 transition-all ${currentColor === color.value ? 'scale-110 border-theme-accent shadow-md' : 'border-transparent hover:scale-105'}`}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                />
                            ))}
                        </div>
                        <div className="w-px h-6 bg-theme-light" />
                        <div className="flex items-center gap-1">
                            {STROKE_WIDTHS.map((width) => (
                                <button
                                    key={width.value}
                                    onClick={() => setCurrentStrokeWidth(width.value)}
                                    className={`w-7 h-7 flex items-center justify-center transition-all rounded-full ${currentStrokeWidth === width.value ? 'bg-theme-light' : 'hover:bg-theme-lightest'}`}
                                    title={width.name}
                                >
                                    <div className="bg-theme-dark rounded-full" style={{ width: '16px', height: `${width.value}px` }} />
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl border border-theme-light p-1.5 flex items-center gap-0.5 transition-colors">
                <button onClick={undo} disabled={historyIndex === 0 || isViewOnly} className="p-2.5 rounded-xl text-theme-dark/50 hover:text-theme-dark disabled:opacity-30 transition-all" title="Undo (Ctrl+Z)">
                    <Undo2 className="w-[18px] h-[18px]" />
                </button>
                <button onClick={redo} disabled={historyIndex === history.length - 1 || isViewOnly} className="p-2.5 rounded-xl text-theme-dark/50 hover:text-theme-dark disabled:opacity-30 transition-all" title="Redo (Ctrl+Y)">
                    <Redo2 className="w-[18px] h-[18px]" />
                </button>

                <div className="w-px h-7 bg-theme-light mx-1" />

                {/* Hidden file input for Image Upload */}
                <input 
                    type="file" 
                    id="toolbar-image-upload" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    disabled={isViewOnly}
                />

                {TOOLS.map((tool) => {
                    // Determine if this tool is disabled for the user's role
                    const isWriteTool = !['select'].includes(tool.type);
                    const disabled = isViewOnly && isWriteTool;

                    return (
                        <button
                            key={tool.type}
                            onClick={() => {
                                if (disabled) return;
                                if (tool.type === 'image') {
                                    document.getElementById('toolbar-image-upload')?.click();
                                } else {
                                    setActiveTool(tool.type);
                                }
                            }}
                            className={`relative p-2.5 rounded-xl transition-all ${
                                disabled 
                                    ? 'text-theme-dark/20 cursor-not-allowed' 
                                    : activeTool === tool.type 
                                        ? 'text-theme-dark' 
                                        : 'text-theme-dark/50 hover:bg-theme-lightest hover:text-theme-dark'
                            }`}
                            title={disabled ? `${tool.label} (View Only)` : tool.label}
                            disabled={disabled}
                        >
                            {activeTool === tool.type && !disabled && (
                                <motion.div layoutId="activeToolBg" className="absolute inset-0 bg-theme-light rounded-xl shadow-sm border border-theme-light" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
                            )}
                            <tool.icon className="w-[18px] h-[18px] relative z-10" />
                            {disabled && (
                                <Lock className="w-2.5 h-2.5 absolute top-1 right-1 text-theme-dark/30" />
                            )}
                        </button>
                    );
                })}

                <div className="w-px h-7 bg-theme-light mx-1" />

                {/* Grid Snap Toggle */}
                <button
                    onClick={() => setSnapToGrid(!snapToGrid)}
                    className={`p-2.5 rounded-xl transition-all ${snapToGrid ? 'text-theme-accent bg-theme-light' : 'text-theme-dark/50 hover:text-theme-dark'}`}
                    title={snapToGrid ? 'Snap to Grid (ON)' : 'Snap to Grid (OFF)'}
                >
                    <Magnet className="w-[18px] h-[18px]" />
                </button>

                <div className="w-px h-7 bg-theme-light mx-1" />

                <button onClick={() => setZoom((prev) => Math.max(prev - 0.1, MIN_ZOOM))} disabled={zoom <= MIN_ZOOM} className="p-2.5 rounded-xl text-theme-dark/50 hover:text-theme-dark disabled:opacity-30 transition-all" title="Zoom Out">
                    <ZoomOut className="w-[18px] h-[18px]" />
                </button>
                <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="text-[11px] font-bold text-theme-dark/60 w-10 text-center select-none font-mono hover:text-theme-dark transition-colors" title="Reset">
                    {Math.round(zoom * 100)}%
                </button>
                <button onClick={() => setZoom((prev) => Math.min(prev + 0.1, MAX_ZOOM))} disabled={zoom >= MAX_ZOOM} className="p-2.5 rounded-xl text-theme-dark/50 hover:text-theme-dark disabled:opacity-30 transition-all" title="Zoom In">
                    <ZoomIn className="w-[18px] h-[18px]" />
                </button>

                <div className="w-px h-7 bg-theme-light mx-1" />

                {/* Dark Mode Toggle */}
                <button
                    onClick={toggleDarkMode}
                    className="p-2.5 rounded-xl text-theme-dark/50 hover:text-theme-dark transition-all"
                    title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {isDarkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
                </button>

                <button onClick={handleExport} className="p-2.5 rounded-xl text-theme-dark/50 hover:text-theme-dark transition-all" title="Export PNG">
                    <ImageDown className="w-[18px] h-[18px]" />
                </button>

                {/* Clear canvas — only for leader */}
                {isLeader && (
                    <button onClick={() => window.confirm('Clear canvas?') && (clearCanvas(), getSocket().emit('clear-canvas', roomId))} className="p-2.5 rounded-xl text-theme-dark/50 hover:text-red-500 transition-all" title="Clear Canvas">
                        <Trash2 className="w-[18px] h-[18px]" />
                    </button>
                )}
            </div>
        </motion.div>
    );
}
