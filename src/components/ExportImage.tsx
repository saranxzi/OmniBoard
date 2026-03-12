'use client';

import { ImageDown } from 'lucide-react';
import { useBoardStore } from '@/store/useBoardStore';

export default function ExportImage() {
    const { theme } = useBoardStore();

    const handleExport = () => {
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) return;

        // Create an off-screen canvas to draw a solid background first
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) return;

        // Fill solid background based on current theme
        ctx.fillStyle = theme === 'dark' ? '#121212' : '#f8fafc';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Draw the user's artwork on top
        ctx.drawImage(canvas, 0, 0);

        // Export the combined result
        const dataUrl = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'omniboard-export.png';
        link.href = dataUrl;
        link.click();
    };

    return (
        <div className="absolute top-6 right-6 z-50 bg-white/70 dark:bg-slate-800/70 hover:bg-white/90 dark:hover:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/50 dark:border-slate-700/50 p-1.5 flex items-center transition-colors duration-300">
            <button
                onClick={handleExport}
                className="p-2 gap-2 flex items-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all font-medium text-sm"
                title="Export as PNG"
            >
                <ImageDown className="w-5 h-5" />
                <span className="hidden sm:inline">Export Image</span>
            </button>
        </div>
    );
}
