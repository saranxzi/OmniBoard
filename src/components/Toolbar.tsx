'use client';

import { MousePointer2, Pencil, Square, Minus, Type, Eraser } from 'lucide-react';
import { useBoardStore, Tool } from '@/store/useBoardStore';
import { motion } from 'framer-motion';

const TOOLS: { type: Tool; icon: React.ElementType; label: string }[] = [
    { type: 'select', icon: MousePointer2, label: 'Select' },
    { type: 'rectangle', icon: Square, label: 'Rectangle' },
    { type: 'line', icon: Minus, label: 'Line' },
    { type: 'pencil', icon: Pencil, label: 'Pencil' },
    { type: 'text', icon: Type, label: 'Text' },
    { type: 'eraser', icon: Eraser, label: 'Eraser' },
];

const COLORS = [
    { name: 'Dark Theme', value: '#424874' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
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
        currentStrokeWidth, setCurrentStrokeWidth
    } = useBoardStore();

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            transition={{ duration: 0.4 }}
            className="fixed bottom-8 left-1/2 z-50 flex flex-col items-center gap-4 w-fit"
        >
            {/* Colors & Thickness (Only show if drawing/text tool) */}
            {(activeTool !== 'select' && activeTool !== 'eraser') && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl shadow-theme-dark/10 border border-theme-light p-2 flex items-center gap-4 transition-colors duration-300"
                >

                    {/* Colors */}
                    <div className="flex items-center gap-3 border-r border-theme-light pr-5">
                        {COLORS.map((color) => (
                            <button
                                key={color.value}
                                onClick={() => setCurrentColor(color.value)}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${currentColor === color.value ? 'scale-110 border-theme-accent shadow-md shadow-theme-accent/30' : 'border-transparent hover:scale-105 hover:border-theme-light'
                                    }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                            />
                        ))}
                    </div>

                    {/* Stroke Widths */}
                    <div className="flex items-center gap-2 px-2">
                        {STROKE_WIDTHS.map((width) => (
                            <button
                                key={width.value}
                                onClick={() => setCurrentStrokeWidth(width.value)}
                                className={`w-9 h-9 flex items-center justify-center transition-all rounded-full ${currentStrokeWidth === width.value ? 'bg-theme-light shadow-sm' : 'hover:bg-theme-lightest'
                                    }`}
                                title={width.name}
                            >
                                <div
                                    className="bg-theme-dark rounded-full"
                                    style={{ width: '100%', height: `${width.value}px`, maxWidth: '20px' }}
                                />
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Tools */}
            <div className="bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl shadow-theme-dark/10 border border-theme-light p-2 flex items-center gap-2 transition-colors duration-300">
                {TOOLS.map((tool) => (
                    <button
                        key={tool.type}
                        onClick={() => setActiveTool(tool.type)}
                        className={`relative p-3 rounded-xl transition-all ${activeTool === tool.type
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
                        <tool.icon className="w-5 h-5 relative z-10" />
                    </button>
                ))}
            </div>
        </motion.div>
    );
}
