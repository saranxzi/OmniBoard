'use client';

import { MousePointer2, Pencil, Square, Minus, Type, Eraser, Moon, Sun } from 'lucide-react';
import { useBoardStore, Tool } from '@/store/useBoardStore';

const TOOLS: { type: Tool; icon: React.ElementType; label: string }[] = [
    { type: 'select', icon: MousePointer2, label: 'Select' },
    { type: 'rectangle', icon: Square, label: 'Rectangle' },
    { type: 'line', icon: Minus, label: 'Line' },
    { type: 'pencil', icon: Pencil, label: 'Pencil' },
    { type: 'text', icon: Type, label: 'Text' },
    { type: 'eraser', icon: Eraser, label: 'Eraser' },
];

const COLORS = [
    { name: 'Slate', value: '#1e293b' },
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
        currentStrokeWidth, setCurrentStrokeWidth,
        theme, toggleTheme
    } = useBoardStore();

    const getThemeAwareColor = (color: string) => {
        if (color === '#1e293b' && theme === 'dark') return '#f8fafc';
        if (color === '#f8fafc' && theme === 'light') return '#1e293b';
        return color;
    };

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
            {/* Tools */}
            <div className="bg-white/70 dark:bg-slate-800/70 hover:bg-white/90 dark:hover:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/50 dark:border-slate-700/50 p-2 flex items-center gap-2 transition-colors duration-300">
                {TOOLS.map((tool) => (
                    <button
                        key={tool.type}
                        onClick={() => setActiveTool(tool.type)}
                        className={`p-3 rounded-xl transition-all ${activeTool === tool.type
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                            }`}
                        title={tool.label}
                    >
                        <tool.icon className="w-5 h-5" />
                    </button>
                ))}

                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1" />
                

                <button
                    onClick={toggleTheme}
                    className="p-3 rounded-xl transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100"
                    title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
            </div>

            {/* Colors & Thickness (Only show if drawing/text tool) */}
            {(activeTool !== 'select' && activeTool !== 'eraser') && (
                <div className="bg-white/70 dark:bg-slate-800/70 hover:bg-white/90 dark:hover:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/50 dark:border-slate-700/50 p-2 flex items-center gap-4 transition-colors duration-300">

                    {/* Colors */}
                    <div className="flex items-center gap-2 border-r border-slate-200/50 dark:border-slate-700/50 pr-4">
                        {COLORS.map((color) => (
                            <button
                                key={color.value}
                                onClick={() => setCurrentColor(color.value)}
                                className={`w-8 h-8 rounded-full border-2 transition-transform ${currentColor === color.value ? 'scale-110 border-blue-500 shadow-md' : 'border-slate-200/50 dark:border-slate-700 hover:scale-105'
                                    }`}
                                style={{ backgroundColor: getThemeAwareColor(color.value) }}
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
                                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${currentStrokeWidth === width.value ? 'bg-blue-100 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                    }`}
                                title={width.name}
                            >
                                <div
                                    className="bg-slate-800 dark:bg-slate-200 rounded-full"
                                    style={{ width: '100%', height: `${width.value}px`, maxWidth: '20px' }}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
