'use client';

import { Undo2, Redo2, Trash2 } from 'lucide-react';
import { useBoardStore } from '@/store/useBoardStore';

export default function UndoRedo() {
    const { undo, redo, historyIndex, history, clearCanvas } = useBoardStore();

    return (
        <div className="absolute top-6 left-6 z-50 bg-white/70 dark:bg-slate-800/70 hover:bg-white/90 dark:hover:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/50 dark:border-slate-700/50 p-1.5 flex items-center gap-1 transition-colors duration-300">
            <button
                onClick={undo}
                disabled={historyIndex === 0}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-all"
                title="Undo (Ctrl+Z)"
            >
                <Undo2 className="w-5 h-5" />
            </button>
            <button
                onClick={redo}
                disabled={historyIndex === history.length - 1}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-all"
                title="Redo (Ctrl+Y)"
            >
                <Redo2 className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button
                onClick={() => {
                    if (window.confirm('Are you sure you want to clear the entire canvas?')) {
                        clearCanvas();
                    }
                }}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-400 transition-all"
                title="Clear Canvas"
            >
                <Trash2 className="w-5 h-5" />
            </button>
        </div>
    );
}
