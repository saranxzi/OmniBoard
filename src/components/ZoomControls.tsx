'use client';

import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useBoardStore, MIN_ZOOM, MAX_ZOOM } from '@/store/useBoardStore';

export default function ZoomControls() {
    const { zoom, setZoom, setPanOffset } = useBoardStore();

    const handleZoomIn = () => {
        setZoom((prev) => Math.min(prev + 0.1, MAX_ZOOM));
    };

    const handleZoomOut = () => {
        setZoom((prev) => Math.max(prev - 0.1, MIN_ZOOM));
    };

    const handleResetZoom = () => {
        setZoom(1);
        setPanOffset({ x: 0, y: 0 }); // Also reset pan to origin
    };

    return (
        <div className="absolute bottom-8 left-6 z-50 bg-white/70 dark:bg-slate-800/70 hover:bg-white/90 dark:hover:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/50 dark:border-slate-700/50 p-1.5 flex items-center gap-1 transition-colors duration-300">
            <button
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-all"
                title="Zoom Out"
            >
                <ZoomOut className="w-5 h-5" />
            </button>

            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 w-12 text-center select-none">
                {Math.round(zoom * 100)}%
            </span>

            <button
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-all"
                title="Zoom In"
            >
                <ZoomIn className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <button
                onClick={handleResetZoom}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                title="Reset Zoom & Pan"
            >
                <Maximize className="w-5 h-5" />
            </button>
        </div>
    );
}
