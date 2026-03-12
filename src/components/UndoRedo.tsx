'use client';

import { Undo2, Redo2, Trash2 } from 'lucide-react';
import { useBoardStore } from '@/store/useBoardStore';
import { motion } from 'framer-motion';
import { getSocket } from '@/lib/socket';
import { useParams } from 'next/navigation';

export default function UndoRedo() {
    const { undo, redo, historyIndex, history, clearCanvas } = useBoardStore();
    const params = useParams();
    const roomId = params.roomId as string;

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.9, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute top-6 left-6 z-50 bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl shadow-theme-dark/10 border border-theme-light p-1.5 flex items-center gap-1 transition-colors duration-300"
        >
            <button
                onClick={undo}
                disabled={historyIndex === 0}
                className="p-2 rounded-xl text-theme-dark/70 hover:bg-theme-lightest hover:text-theme-dark disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Undo (Ctrl+Z)"
            >
                <Undo2 className="w-5 h-5" />
            </button>
            <button
                onClick={redo}
                disabled={historyIndex === history.length - 1}
                className="p-2 rounded-xl text-theme-dark/70 hover:bg-theme-lightest hover:text-theme-dark disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Redo (Ctrl+Y)"
            >
                <Redo2 className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-theme-light mx-1" />
            <button
                onClick={() => {
                    if (window.confirm('Are you sure you want to clear the entire canvas?')) {
                        clearCanvas();
                        getSocket().emit('clear-canvas', roomId);
                    }
                }}
                className="p-2 rounded-xl text-theme-dark/70 hover:bg-red-50 hover:text-red-500 transition-all hover:shadow-sm"
                title="Clear Canvas"
            >
                <Trash2 className="w-5 h-5" />
            </button>
        </motion.div>
    );
}
