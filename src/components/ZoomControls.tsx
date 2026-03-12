'use client';

import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useBoardStore, MIN_ZOOM, MAX_ZOOM } from '@/store/useBoardStore';
import { motion } from 'framer-motion';

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
        <motion.div 
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute bottom-8 right-6 z-50 bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl shadow-theme-dark/10 border border-theme-light p-1.5 flex items-center gap-1 transition-colors duration-300"
        >
            <button
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
                className="p-2 rounded-xl text-theme-dark/70 hover:bg-theme-lightest hover:text-theme-dark disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Zoom Out"
            >
                <ZoomOut className="w-5 h-5" />
            </button>

            <span className="text-xs font-bold text-theme-dark w-12 text-center select-none font-mono tracking-widest">
                {Math.round(zoom * 100)}%
            </span>

            <button
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
                className="p-2 rounded-xl text-theme-dark/70 hover:bg-theme-lightest hover:text-theme-dark disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Zoom In"
            >
                <ZoomIn className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-theme-light mx-1"></div>

            <button
                onClick={handleResetZoom}
                className="p-2 rounded-xl text-theme-dark/70 hover:bg-theme-lightest hover:text-theme-dark transition-all"
                title="Reset Zoom & Pan"
            >
                <Maximize className="w-5 h-5" />
            </button>
        </motion.div>
    );
}
