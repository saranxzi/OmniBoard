'use client';

import { ImageDown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ExportImage() {
    const handleExport = () => {
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) return;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const ctx = exportCanvas.getContext('2d');
        if (!ctx) return;

        // Fill with theme-lightest background
        ctx.fillStyle = '#F4EEFF';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Draw the user's artwork on top
        ctx.drawImage(canvas, 0, 0);

        const dataUrl = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'omniboard-export.png';
        link.href = dataUrl;
        link.click();
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute top-6 right-6 z-50 bg-white/80 hover:bg-white backdrop-blur-2xl rounded-2xl shadow-xl shadow-theme-dark/10 border border-theme-light p-1.5 flex items-center transition-colors duration-300"
        >
            <button
                onClick={handleExport}
                className="p-2 gap-2 flex items-center rounded-xl text-theme-dark/70 hover:bg-theme-lightest hover:text-theme-dark transition-all font-medium text-sm"
                title="Export as PNG"
            >
                <ImageDown className="w-5 h-5" />
                <span className="hidden sm:inline">Export</span>
            </button>
        </motion.div>
    );
}
