'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import { Map as MapIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Minimap — A floating HUD in the bottom-right corner showing a bird's-eye view
 * of all canvas elements. Click to navigate, drag the viewport rectangle to pan.
 */
const MINIMAP_W = 200;
const MINIMAP_H = 150;

export default function Minimap() {
    const { elements, panOffset, setPanOffset, zoom, showMinimap, setShowMinimap } = useBoardStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Calculate the bounding box of all elements
    const getBounds = useCallback(() => {
        if (elements.length === 0) {
            return { minX: -500, minY: -500, maxX: 500, maxY: 500 };
        }
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
        // Add generous padding
        const pad = Math.max((maxX - minX), (maxY - minY)) * 0.2 + 200;
        return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
    }, [elements]);

    // Render the minimap
    useEffect(() => {
        if (!showMinimap || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = MINIMAP_W * dpr;
        canvas.height = MINIMAP_H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Clear
        ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);

        const bounds = getBounds();
        const worldW = bounds.maxX - bounds.minX;
        const worldH = bounds.maxY - bounds.minY;
        const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);

        // Center the content
        const offsetX = (MINIMAP_W - worldW * scale) / 2;
        const offsetY = (MINIMAP_H - worldH * scale) / 2;

        // Draw mini elements
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.translate(-bounds.minX, -bounds.minY);

        elements.forEach(el => {
            ctx.fillStyle = el.type === 'sticky' ? (el.stickyColor || '#fef08a') : (el.color || '#424874');
            ctx.strokeStyle = el.color || '#424874';
            ctx.lineWidth = 1 / scale;

            if (el.type === 'pencil' && el.points && el.points.length > 1) {
                ctx.beginPath();
                ctx.moveTo(el.points[0].x, el.points[0].y);
                el.points.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
            } else if (el.type === 'ellipse') {
                const cx = (el.x1 + el.x2) / 2;
                const cy = (el.y1 + el.y2) / 2;
                const rx = Math.abs(el.x2 - el.x1) / 2;
                const ry = Math.abs(el.y2 - el.y1) / 2;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (el.type === 'image' || el.type === 'sticky') {
                ctx.globalAlpha = 0.6;
                ctx.fillRect(el.x1, el.y1, el.x2 - el.x1, el.y2 - el.y1);
                ctx.globalAlpha = 1;
            } else if (el.type === 'text') {
                ctx.fillStyle = el.color || '#424874';
                ctx.fillRect(el.x1, el.y1 - 8, (el.text?.length || 3) * 6, 10);
            } else {
                ctx.strokeRect(el.x1, el.y1, el.x2 - el.x1, el.y2 - el.y1);
            }
        });

        ctx.restore();

        // Draw viewport rectangle
        const vpLeft = -panOffset.x / zoom;
        const vpTop = -panOffset.y / zoom;
        const vpW = window.innerWidth / zoom;
        const vpH = window.innerHeight / zoom;

        const vx = offsetX + (vpLeft - bounds.minX) * scale;
        const vy = offsetY + (vpTop - bounds.minY) * scale;
        const vw = vpW * scale;
        const vh = vpH * scale;

        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(vx, vy, vw, vh);
        ctx.setLineDash([]);

        // Light fill for viewport
        ctx.fillStyle = 'rgba(129, 140, 248, 0.08)';
        ctx.fillRect(vx, vy, vw, vh);

    }, [elements, panOffset, zoom, showMinimap, getBounds]);

    /** Convert minimap click position to world coordinates and pan to it */
    const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const bounds = getBounds();
        const worldW = bounds.maxX - bounds.minX;
        const worldH = bounds.maxY - bounds.minY;
        const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);
        const offsetX = (MINIMAP_W - worldW * scale) / 2;
        const offsetY = (MINIMAP_H - worldH * scale) / 2;

        // Convert minimap coords to world coords
        const worldX = (mx - offsetX) / scale + bounds.minX;
        const worldY = (my - offsetY) / scale + bounds.minY;

        // Center viewport on that position
        const vpCenterX = worldX - (window.innerWidth / zoom) / 2;
        const vpCenterY = worldY - (window.innerHeight / zoom) / 2;
        setPanOffset({ x: -vpCenterX * zoom, y: -vpCenterY * zoom });
    }, [getBounds, zoom, setPanOffset]);

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setShowMinimap(!showMinimap)}
                className="fixed bottom-24 right-4 z-50 p-2 rounded-xl bg-white/80 dark:bg-[rgba(22,22,38,0.85)] backdrop-blur-xl border border-theme-light shadow-lg text-theme-dark/60 hover:text-theme-dark transition-all"
                title={showMinimap ? 'Hide Minimap' : 'Show Minimap'}
            >
                {showMinimap ? <X className="w-4 h-4" /> : <MapIcon className="w-4 h-4" />}
            </button>

            {/* Minimap Panel */}
            <AnimatePresence>
                {showMinimap && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="fixed bottom-24 right-16 z-50 rounded-2xl overflow-hidden shadow-xl border border-theme-light bg-white/90 dark:bg-[rgba(15,15,26,0.92)] backdrop-blur-2xl"
                    >
                        <canvas
                            ref={canvasRef}
                            width={MINIMAP_W}
                            height={MINIMAP_H}
                            className="cursor-pointer block"
                            style={{ width: MINIMAP_W, height: MINIMAP_H }}
                            onClick={handleClick}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
