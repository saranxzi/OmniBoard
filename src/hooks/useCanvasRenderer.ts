import { useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import rough from 'roughjs';
import { Drawable } from 'roughjs/bin/core';
import getStroke from 'perfect-freehand';
import { useBoardStore } from '@/store/useBoardStore';
import { Element, ElementLock } from '@/types';
import { getSvgPathFromStroke } from '@/lib/geometry';
import { resolveConnectorEndpoints } from '@/lib/connectors';

/**
 * Handles all canvas rendering: grid dots (on offscreen canvas for perf),
 * element drawing (rough.js shapes, pencil strokes, text, arrows, images, connectors, stickies),
 * selection highlights, resize handles, and element lock indicators.
 * Also manages canvas DPR sizing.
 */

// Image cache: prevent re-decoding base64 every frame
const imageCache = new Map<string, HTMLImageElement>();

function getCachedImage(dataUrl: string): HTMLImageElement | null {
    if (imageCache.has(dataUrl)) {
        const img = imageCache.get(dataUrl)!;
        return img.complete ? img : null;
    }
    const img = new Image();
    img.src = dataUrl;
    imageCache.set(dataUrl, img);
    img.onload = () => {
        // Will be available on next render cycle
    };
    return img.complete ? img : null;
}

interface CanvasRendererOptions {
    lockedElements?: Record<string, ElementLock>;
}

export function useCanvasRenderer(options?: CanvasRendererOptions) {
    const { elements, panOffset, zoom, selectedElement, isDarkMode } = useBoardStore();
    const lockedElementsMemo = useMemo(() => options?.lockedElements || {}, [options?.lockedElements]);
    const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const lastGridKeyRef = useRef('');

    /** Pre-render grid dots onto an offscreen canvas. Recomputes only when zoom/size changes. */
    const renderGrid = useCallback((width: number, height: number, ctx: CanvasRenderingContext2D) => {
        const GRID_SIZE = 40 * zoom;
        const key = `${width}:${height}:${zoom}:${isDarkMode}`;

        if (lastGridKeyRef.current !== key) {
            if (!gridCanvasRef.current) {
                gridCanvasRef.current = document.createElement('canvas');
            }
            const gc = gridCanvasRef.current;
            gc.width = width;
            gc.height = height;
            const gctx = gc.getContext('2d')!;
            gctx.clearRect(0, 0, width, height);
            gctx.fillStyle = isDarkMode ? '#1e1f32' : '#DCD6F7';
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

        const offsetX = panOffset.x % GRID_SIZE;
        const offsetY = panOffset.y % GRID_SIZE;
        ctx.drawImage(gridCanvasRef.current!, offsetX - GRID_SIZE, offsetY - GRID_SIZE);
    }, [zoom, panOffset, isDarkMode]);

    useLayoutEffect(() => {
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d')!;
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);

        // Dark mode canvas background fill
        if (isDarkMode) {
            ctx.fillStyle = '#0f0f1a';
            ctx.fillRect(0, 0, rect.width, rect.height);
        }

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
            const opts = { stroke: color, strokeWidth: element.strokeWidth, roughness: 1.5 };

            // ── Pencil ──
            if (element.type === 'pencil' && element.points) {
                const stroke = getStroke(element.points.map(p => [p.x, p.y]), {
                    size: element.strokeWidth,
                    thinning: 0.5,
                    smoothing: 0.5,
                    streamline: 0.5,
                });
                const pathData = getSvgPathFromStroke(stroke);
                const path = new Path2D(pathData);
                ctx.fillStyle = color;
                ctx.fill(path);
            }
            // ── Text ──
            else if (element.type === 'text') {
                ctx.font = '28px "Kalam", cursive';
                ctx.fillStyle = color;
                const lines = (element.text || '').split('\n');
                lines.forEach((line, i) => {
                    ctx.fillText(line, element.x1, element.y1 + i * 32);
                });
            }
            // ── Image ──
            else if (element.type === 'image' && element.imageDataUrl) {
                const img = getCachedImage(element.imageDataUrl);
                if (img) {
                    const w = element.x2 - element.x1;
                    const h = element.y2 - element.y1;
                    // Draw shadow for depth
                    ctx.shadowColor = 'rgba(0,0,0,0.12)';
                    ctx.shadowBlur = 12 / zoom;
                    ctx.shadowOffsetX = 2 / zoom;
                    ctx.shadowOffsetY = 4 / zoom;
                    ctx.drawImage(img, element.x1, element.y1, w, h);
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;
                    // Thin border
                    ctx.strokeStyle = '#A6B1E1';
                    ctx.lineWidth = 1.5 / zoom;
                    ctx.strokeRect(element.x1, element.y1, w, h);
                } else {
                    // Loading placeholder
                    const w = element.x2 - element.x1;
                    const h = element.y2 - element.y1;
                    ctx.fillStyle = '#f0f0f0';
                    ctx.fillRect(element.x1, element.y1, w, h);
                    ctx.fillStyle = '#999';
                    ctx.font = `${14 / zoom}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText('Loading...', element.x1 + w / 2, element.y1 + h / 2);
                    ctx.textAlign = 'start';
                }
            }
            // ── Connector ──
            else if (element.type === 'connector') {
                const { start, end } = resolveConnectorEndpoints(element, elements);
                // Draw the connector line with rough.js for consistent aesthetic
                const re = rough.generator().line(start.x, start.y, end.x, end.y, {
                    ...opts,
                    strokeLineDash: [8, 4],
                });
                rc.draw(re);
                // Arrow head at the end
                const angle = Math.atan2(end.y - start.y, end.x - start.x);
                const headLen = 12;
                ctx.beginPath();
                ctx.moveTo(end.x, end.y);
                ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(end.x, end.y);
                ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
                ctx.strokeStyle = color;
                ctx.lineWidth = element.strokeWidth;
                ctx.stroke();
                // Snap point indicators (small circles at endpoints if connected)
                if (element.connectedFrom) {
                    ctx.fillStyle = '#A6B1E1';
                    ctx.beginPath();
                    ctx.arc(start.x, start.y, 4 / zoom, 0, Math.PI * 2);
                    ctx.fill();
                }
                if (element.connectedTo) {
                    ctx.fillStyle = '#A6B1E1';
                    ctx.beginPath();
                    ctx.arc(end.x, end.y, 4 / zoom, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            // ── Sticky Note (enhanced) ──
            else if (element.type === 'sticky') {
                const w = element.x2 - element.x1;
                const fillColor = element.stickyColor || '#fef08a';
                // Shadow
                ctx.shadowColor = 'rgba(0,0,0,0.10)';
                ctx.shadowBlur = 10 / zoom;
                ctx.shadowOffsetX = 2 / zoom;
                ctx.shadowOffsetY = 4 / zoom;
                // Filled rectangle
                ctx.fillStyle = fillColor;
                ctx.beginPath();
                const radius = 6 / zoom;
                ctx.moveTo(element.x1 + radius, element.y1);
                ctx.lineTo(element.x2 - radius, element.y1);
                ctx.quadraticCurveTo(element.x2, element.y1, element.x2, element.y1 + radius);
                ctx.lineTo(element.x2, element.y2 - radius);
                ctx.quadraticCurveTo(element.x2, element.y2, element.x2 - radius, element.y2);
                ctx.lineTo(element.x1 + radius, element.y2);
                ctx.quadraticCurveTo(element.x1, element.y2, element.x1, element.y2 - radius);
                ctx.lineTo(element.x1, element.y1 + radius);
                ctx.quadraticCurveTo(element.x1, element.y1, element.x1 + radius, element.y1);
                ctx.closePath();
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                // Border
                ctx.strokeStyle = adjustColorHex(fillColor, -40);
                ctx.lineWidth = 1 / zoom;
                ctx.stroke();
                // Text rendering with word wrap
                if (element.text) {
                    ctx.fillStyle = '#1e293b';
                    ctx.font = '18px "Kalam", cursive';
                    const padding = 12;
                    const maxWidth = w - padding * 2;
                    const lines = wrapText(ctx, element.text, maxWidth);
                    lines.forEach((line, i) => {
                        ctx.fillText(line, element.x1 + padding, element.y1 + padding + 20 + i * 24);
                    });
                }
            }
            // ── All other rough.js shapes ──
            else {
                let re = element.roughElement;
                if (!re) {
                    const { x1, y1, x2, y2, type } = element;
                    if (type === 'rectangle') {
                        re = rough.generator().rectangle(x1, y1, x2 - x1, y2 - y1, opts);
                    } else if (type === 'ellipse') {
                        const cx = (x1 + x2) / 2;
                        const cy = (y1 + y2) / 2;
                        const width = Math.abs(x2 - x1);
                        const height = Math.abs(y2 - y1);
                        re = rough.generator().ellipse(cx, cy, width, height, opts);
                    } else if (type === 'diamond') {
                        const cx = (x1 + x2) / 2;
                        const cy = (y1 + y2) / 2;
                        const hw = (x2 - x1) / 2;
                        const hh = (y2 - y1) / 2;
                        re = rough.generator().polygon([[cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]], opts);
                    } else if (type === 'line' || type === 'arrow') {
                        re = rough.generator().line(x1, y1, x2, y2, opts);
                    } else if (type === 'star') {
                        const cx = (x1 + x2) / 2;
                        const cy = (y1 + y2) / 2;
                        const rx = Math.abs(x2 - x1) / 2;
                        const ry = Math.abs(y2 - y1) / 2;
                        const pts: [number, number][] = [];
                        for (let i = 0; i < 10; i++) {
                            const angle = (i * Math.PI) / 5 - Math.PI / 2;
                            const r = i % 2 === 0 ? Math.max(rx, ry) : Math.max(rx, ry) / 2.5;
                            pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
                        }
                        re = rough.generator().polygon(pts, opts);
                    }
                }

                if (re) {
                    const tempOptions = { ...re.options, stroke: color };
                    re.sets.forEach(() => {
                        rc.draw({ ...re, options: tempOptions } as Drawable);
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
            }

            // ── Lock indicator ──
            const lock = lockedElementsMemo[element.id];
            if (lock) {
                drawLockIndicator(ctx, element, lock, zoom);
            }

            // ── Selection highlight ──
            if (selectedElement && element.id === selectedElement.id) {
                drawSelectionBorder(ctx, element, zoom);
            }
        });

        ctx.restore();
    }, [elements, panOffset, zoom, selectedElement, renderGrid, lockedElementsMemo, isDarkMode]);
}

// ═══════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════

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

/** Draws a subtle lock indicator over elements being edited by other users. */
function drawLockIndicator(ctx: CanvasRenderingContext2D, element: Element, lock: ElementLock, zoom: number) {
    const cx = (element.x1 + element.x2) / 2;
    const topY = Math.min(element.y1, element.y2) - 24 / zoom;

    // Lock badge background
    const badgeW = 80 / zoom;
    const badgeH = 20 / zoom;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    const r = 4 / zoom;
    ctx.beginPath();
    ctx.moveTo(cx - badgeW / 2 + r, topY);
    ctx.lineTo(cx + badgeW / 2 - r, topY);
    ctx.quadraticCurveTo(cx + badgeW / 2, topY, cx + badgeW / 2, topY + r);
    ctx.lineTo(cx + badgeW / 2, topY + badgeH - r);
    ctx.quadraticCurveTo(cx + badgeW / 2, topY + badgeH, cx + badgeW / 2 - r, topY + badgeH);
    ctx.lineTo(cx - badgeW / 2 + r, topY + badgeH);
    ctx.quadraticCurveTo(cx - badgeW / 2, topY + badgeH, cx - badgeW / 2, topY + badgeH - r);
    ctx.lineTo(cx - badgeW / 2, topY + r);
    ctx.quadraticCurveTo(cx - badgeW / 2, topY, cx - badgeW / 2 + r, topY);
    ctx.closePath();
    ctx.fill();

    // Lock badge text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${10 / zoom}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`🔒 ${lock.userName}`, cx, topY + badgeH / 2 + 3 / zoom);
    ctx.textAlign = 'start';

    // Subtle border overlay
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(element.x1, element.y1, element.x2 - element.x1, element.y2 - element.y1);
    ctx.setLineDash([]);
}

/** Simple text wrapping for sticky notes. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const paragraphs = text.split('\n');
    const lines: string[] = [];
    for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        let currentLine = '';
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);
    }
    return lines;
}

/** Adjust a hex color by an amount (positive = lighter, negative = darker). */
function adjustColorHex(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
