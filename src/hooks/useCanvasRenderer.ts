import { useLayoutEffect, useRef, useCallback } from 'react';
import rough from 'roughjs';
import { Drawable } from 'roughjs/bin/core';
import getStroke from 'perfect-freehand';
import { useBoardStore, Element } from '@/store/useBoardStore';
import { getSvgPathFromStroke } from '@/utils/board';

/**
 * Handles all canvas rendering: grid dots (on offscreen canvas for perf),
 * element drawing (rough.js shapes, pencil strokes, text, arrows),
 * selection highlights, and resize handles. Also manages canvas DPR sizing.
 */
export function useCanvasRenderer() {
    const { elements, panOffset, zoom, selectedElement } = useBoardStore();
    const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastGridKeyRef = useRef('');

    /** Pre-render grid dots onto an offscreen canvas. Recomputes only when zoom/size changes. */
    const renderGrid = useCallback((width: number, height: number, ctx: CanvasRenderingContext2D) => {
        const GRID_SIZE = 40 * zoom;
        const key = `${width}:${height}:${zoom}`;

        if (lastGridKeyRef.current !== key) {
            // Regenerate offscreen grid
            if (!gridCanvasRef.current) {
                gridCanvasRef.current = document.createElement('canvas');
            }
            const gc = gridCanvasRef.current;
            gc.width = width;
            gc.height = height;
            const gctx = gc.getContext('2d')!;
            gctx.clearRect(0, 0, width, height);
            gctx.fillStyle = '#DCD6F7';
            const dotRadius = 1.5 * Math.min(Math.max(zoom, 0.5), 2);
            for (let x = 0; x < width; x += GRID_SIZE) {
                for (let y = 0; y < height; y += GRID_SIZE) {
                    gctx.beginPath();
                    gctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                    gctx.fill();
                }
            }
            lastGridKeyRef.current = key;
        }

        // Draw the cached grid with pan offset
        const offsetX = panOffset.x % GRID_SIZE;
        const offsetY = panOffset.y % GRID_SIZE;
        ctx.drawImage(gridCanvasRef.current!, offsetX - GRID_SIZE, offsetY - GRID_SIZE);
    }, [zoom, panOffset]);

    useLayoutEffect(() => {
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) return;

        // Handle high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d')!;
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Grid
        renderGrid(rect.width, rect.height, ctx);

        // Transform for world space
        ctx.save();
        ctx.translate(panOffset.x, panOffset.y);
        ctx.scale(zoom, zoom);

        const rc = rough.canvas(canvas);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        elements.forEach((element) => {
            const color = element.color;

            if (element.type === 'pencil' && element.points) {
                const stroke = getStroke(element.points.map(p => [p.x, p.y]), {
                    size: element.strokeWidth / zoom,
                    thinning: 0.5,
                    smoothing: 0.5,
                    streamline: 0.5,
                });
                const pathData = getSvgPathFromStroke(stroke);
                const path = new Path2D(pathData);
                ctx.fillStyle = color;
                ctx.fill(path);
            } else if (element.type === 'text') {
                ctx.font = '28px "Kalam", cursive';
                ctx.fillStyle = color;
                ctx.fillText(element.text || '', element.x1, element.y1);
            } else if (element.roughElement) {
                const tempOptions = { ...element.roughElement.options, stroke: color };
                element.roughElement.sets.forEach(() => {
                    rc.draw({ ...element.roughElement, options: tempOptions } as Drawable);
                });

                // Arrow head
                if (element.type === 'arrow') {
                    const { x1, y1, x2, y2 } = element;
                    const angle = Math.atan2(y2 - y1, x2 - x1);
                    const headLen = 15;
                    ctx.beginPath();
                    ctx.moveTo(x2, y2);
                    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
                    ctx.moveTo(x2, y2);
                    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
                    ctx.strokeStyle = color;
                    ctx.lineWidth = element.strokeWidth;
                    ctx.stroke();
                }
            }

            // Selection highlight
            if (selectedElement && element.id === selectedElement.id) {
                drawSelectionBorder(ctx, element, zoom);
            }
        });

        ctx.restore();
    }, [elements, panOffset, zoom, selectedElement, renderGrid]);
}

/** Draws a dashed selection border and resize handles around the selected element. */
function drawSelectionBorder(ctx: CanvasRenderingContext2D, element: Element, zoom: number) {
    let minX = element.x1, minY = element.y1, maxX = element.x2, maxY = element.y2;

    if (element.type === 'pencil' && element.points) {
        minX = Math.min(...element.points.map(p => p.x));
        maxX = Math.max(...element.points.map(p => p.x));
        minY = Math.min(...element.points.map(p => p.y));
        maxY = Math.max(...element.points.map(p => p.y));
    } else if (element.type === 'text' && element.text) {
        minX = element.x1;
        minY = element.y1 - 24;
        maxX = element.x1 + element.text.length * 14;
        maxY = element.y1 + 4;
    }

    const padding = 8 / zoom;
    ctx.strokeStyle = '#A6B1E1';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([5 / zoom, 5 / zoom]);
    ctx.strokeRect(
        Math.min(minX, maxX) - padding,
        Math.min(minY, maxY) - padding,
        Math.abs(maxX - minX) + padding * 2,
        Math.abs(maxY - minY) + padding * 2
    );
    ctx.setLineDash([]);

    if (element.type !== 'pencil' && element.type !== 'text') {
        const handleSize = 8 / zoom;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#A6B1E1';
        ctx.lineWidth = 1.5 / zoom;

        const drawHandle = (hx: number, hy: number) => {
            ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        };

        drawHandle(element.x1, element.y1);
        drawHandle(element.x2, element.y1);
        drawHandle(element.x1, element.y2);
        drawHandle(element.x2, element.y2);
    }
}
