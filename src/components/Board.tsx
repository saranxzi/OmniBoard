'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { Drawable } from 'roughjs/bin/core';
import { useBoardStore, Element, Point, Tool } from '@/store/useBoardStore';
import getStroke from 'perfect-freehand';
import {
    distance, isPointOnLine, getElementAtPosition,
    getSvgPathFromStroke, createElement, getResizeHandleHit, ResizeHandle
} from '@/utils/board';
import rough from 'roughjs';

export default function Board() {
    const {
        elements, setElements, activeTool, setActiveTool, panOffset,
        setPanOffset, zoom, setZoom, selectedElement, setSelectedElement,
        currentColor, currentStrokeWidth, theme
    } = useBoardStore();

    const [isDrawing, setIsDrawing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDirection, setResizeDirection] = useState<ResizeHandle>(null);
    const [hoverHandle, setHoverHandle] = useState<ResizeHandle>(null);
    const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
    const [writingPosition, setWritingPosition] = useState<{ id: string; x: number; y: number } | null>(null);

    // Convert screen coordinates to canvas world coordinates
    const getMouseCoordinates = (clientX: number, clientY: number) => {
        return {
            x: (clientX - panOffset.x) / zoom,
            y: (clientY - panOffset.y) / zoom,
        };
    };

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    useLayoutEffect(() => {
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.save();

        // --- Draw Infinite Dot Grid ---
        // We draw the grid *before* applying the user's zoom/pan to the context,
        // so we can mathematically perfectly space the dots on the physical screen
        // while making them *appear* to pan and zoom.
        const GRID_SIZE = 40 * zoom;
        const offsetX = panOffset.x % GRID_SIZE;
        const offsetY = panOffset.y % GRID_SIZE;

        ctx.fillStyle = theme === 'dark' ? '#334155' : '#cbd5e1';

        for (let x = offsetX; x < canvas.width; x += GRID_SIZE) {
            for (let y = offsetY; y < canvas.height; y += GRID_SIZE) {
                ctx.beginPath();
                ctx.arc(x, y, 1.5 * Math.min(Math.max(zoom, 0.5), 2), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // ------------------------------

        ctx.translate(panOffset.x, panOffset.y);
        ctx.scale(zoom, zoom);

        const rc = rough.canvas(canvas);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const getThemeAwareColor = (color: string) => {
            if (color === '#1e293b' && theme === 'dark') return '#f8fafc';
            if (color === '#f8fafc' && theme === 'light') return '#1e293b';
            return color;
        };

        elements.forEach((element) => {
            const displayColor = getThemeAwareColor(element.color);

            if (element.type === 'pencil' && element.points) {
                const stroke = getStroke(element.points.map(p => [p.x, p.y]), {
                    size: element.strokeWidth / zoom, // Keep pencil stroke consistent regardless of zoom
                    thinning: 0.5,
                    smoothing: 0.5,
                    streamline: 0.5,
                });

                const pathData = getSvgPathFromStroke(stroke);
                const path = new Path2D(pathData);
                ctx.fillStyle = displayColor;
                ctx.fill(path);
            } else if (element.type === 'text') {
                ctx.font = '28px "Kalam", cursive';
                ctx.fillStyle = displayColor;
                ctx.fillText(element.text || '', element.x1, element.y1);
            } else if (element.roughElement) {
                // If it's roughjs, we must alter the stroke color dynamically without mutating the store
                const originalOptions = element.roughElement.options;
                const tempOptions = { ...originalOptions, stroke: displayColor };

                // Nasty hack to draw rough element with different theme color, 
                // since options are usually baked into the cached Drawable.
                // Re-baking is expensive, so we just mutate the stroke on context just before draw?
                // Actually RoughJs renders using its own internal operations array. 
                // The easiest way is to modify the primitive ops:
                element.roughElement.sets.forEach(() => {
                    rc.draw({ ...element.roughElement, options: tempOptions } as Drawable);
                });
            }

            // Draw selection bounding box
            if (selectedElement && element.id === selectedElement.id) {
                let minX = element.x1, minY = element.y1, maxX = element.x2, maxY = element.y2;

                if (element.type === 'pencil' && element.points) {
                    minX = Math.min(...element.points.map(p => p.x));
                    maxX = Math.max(...element.points.map(p => p.x));
                    minY = Math.min(...element.points.map(p => p.y));
                    maxY = Math.max(...element.points.map(p => p.y));
                } else if (element.type === 'text') {
                    minX = element.x1;
                    minY = element.y1 - 24;
                    maxX = element.x1 + (element.text?.length || 0) * 14;
                    maxY = element.y1 + 4;
                }

                const padding = 8 / zoom;
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2 / zoom;
                ctx.setLineDash([5 / zoom, 5 / zoom]);
                ctx.strokeRect(
                    Math.min(minX, maxX) - padding,
                    Math.min(minY, maxY) - padding,
                    Math.abs(maxX - minX) + padding * 2,
                    Math.abs(maxY - minY) + padding * 2
                );
                ctx.setLineDash([]); // Reset line dash

                // Draw resize handles for shapes and lines (not pencil/text)
                if (element.type !== 'pencil' && element.type !== 'text') {
                    const handleSize = 8 / zoom;
                    ctx.fillStyle = theme === 'dark' ? '#1e293b' : '#ffffff';
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1.5 / zoom;

                    const drawHandle = (hx: number, hy: number) => {
                        ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
                        ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
                    };

                    drawHandle(element.x1, element.y1); // NW
                    drawHandle(element.x2, element.y1); // NE
                    drawHandle(element.x1, element.y2); // SW
                    drawHandle(element.x2, element.y2); // SE
                }
            }
        });

        ctx.restore();
    }, [elements, panOffset, zoom, selectedElement, theme]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) {
                    useBoardStore.getState().redo();
                } else {
                    useBoardStore.getState().undo();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                useBoardStore.getState().redo();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        if (!canvas) return;

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            // Trigger a re-render to draw elements on new sized canvas
            setElements((prev) => [...prev]);
        };

        handleResize(); // Initial setup
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [setElements]);

    const handlePointerDown = (e: React.PointerEvent) => {
        const { clientX, clientY } = e;
        const { x, y } = getMouseCoordinates(clientX, clientY);

        if (activeTool === 'select' || activeTool === 'eraser') {

            // Check for Resize Handle Hit FIRST
            if (activeTool === 'select' && selectedElement) {
                const resizeHit = getResizeHandleHit(x, y, selectedElement, zoom);
                if (resizeHit) {
                    setIsResizing(true);
                    setResizeDirection(resizeHit);
                    setDragStartPoint({ x, y });
                    return;
                }
            }

            const hitElement = getElementAtPosition(x, y, elements);

            if (activeTool === 'eraser') {
                if (hitElement) {
                    const newElements = elements.filter(el => el.id !== hitElement.id);
                    setElements(newElements);
                }
                setIsDrawing(true); // Re-use isDrawing as "isErasing" to track drag state
                return;
            }

            setSelectedElement(hitElement);

            if (hitElement) {
                setIsDragging(true);
                setDragStartPoint({ x, y });
            } else {
                setIsDragging(false);
            }
            return;
        }

        if (activeTool === 'text') {
            return;
        }

        setIsDrawing(true);

        const id = elements.length.toString();
        const element = createElement(id, x, y, x, y, activeTool, currentColor, currentStrokeWidth);
        setElements((prevState) => [...prevState, element]);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const { clientX, clientY } = e;
        const { x, y } = getMouseCoordinates(clientX, clientY);

        if (activeTool === 'select' || activeTool === 'eraser') {
            if (activeTool === 'select' && selectedElement && !isDragging && !isResizing && !isDrawing) {
                const hoverHit = getResizeHandleHit(x, y, selectedElement, zoom);
                if (hoverHit !== hoverHandle) {
                    setHoverHandle(hoverHit);
                }
            } else if (hoverHandle !== null && !isResizing) {
                setHoverHandle(null);
            }

            if (activeTool === 'eraser' && isDrawing) {
                const hitElement = getElementAtPosition(x, y, elements);
                if (hitElement) {
                    const newElements = elements.filter(el => el.id !== hitElement.id);
                    setElements(newElements, true); // Overwrite history to prevent lag
                }
                return;
            }

            if (isResizing && selectedElement && resizeDirection && dragStartPoint) {
                const dx = x - dragStartPoint.x;
                const dy = y - dragStartPoint.y;

                const index = elements.findIndex(el => el.id === selectedElement.id);
                if (index === -1) return;

                const el = elements[index];
                let { x1, y1, x2, y2 } = el;

                if (resizeDirection === 'nw') { x1 += dx; y1 += dy; }
                else if (resizeDirection === 'ne') { x2 += dx; y1 += dy; }
                else if (resizeDirection === 'sw') { x1 += dx; y2 += dy; }
                else if (resizeDirection === 'se') { x2 += dx; y2 += dy; }

                const resizedElement = createElement(el.id, x1, y1, x2, y2, el.type, el.color, el.strokeWidth, el.text);

                const elementsCopy = [...elements];
                elementsCopy[index] = resizedElement;

                setElements(elementsCopy, true);
                setSelectedElement(resizedElement);
                setDragStartPoint({ x, y });
                return;
            }

            if (e.buttons === 1 && !isDragging) {
                // Pan with middle mouse button or select tool drag (missed element)
                setPanOffset((prev) => ({
                    x: prev.x + e.movementX,
                    y: prev.y + e.movementY,
                }));
            } else if (isDragging && selectedElement && dragStartPoint) {
                // Moving an element
                const dx = x - dragStartPoint.x;
                const dy = y - dragStartPoint.y;

                const index = elements.findIndex(el => el.id === selectedElement.id);
                if (index === -1) return;

                const el = elements[index];
                let movedElement: Element;

                if (el.type === 'pencil' && el.points) {
                    movedElement = {
                        ...el,
                        x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy,
                        points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
                    };
                } else {
                    movedElement = createElement(el.id, el.x1 + dx, el.y1 + dy, el.x2 + dx, el.y2 + dy, el.type, el.color, el.strokeWidth, el.text);
                }

                const elementsCopy = [...elements];
                elementsCopy[index] = movedElement;

                setElements(elementsCopy, true); // Overwrite history during drag
                setSelectedElement(movedElement); // Keep selection updated
                setDragStartPoint({ x, y }); // Reset drag start for next frame
            }
            return;
        }

        if (!isDrawing) return;

        const index = elements.length - 1;
        const { x1, y1, type, points } = elements[index];

        let updatedElement: Element;

        if (type === 'pencil') {
            updatedElement = {
                ...elements[index],
                points: [...(points || []), { x, y }]
            };
        } else {
            updatedElement = createElement(index.toString(), x1, y1, x, y, type, elements[index].color, elements[index].strokeWidth, elements[index].text);
        }

        const elementsCopy = [...elements];
        elementsCopy[index] = updatedElement;
        setElements(elementsCopy, true);
    };

    const handlePointerUp = () => {
        if (isDrawing || isDragging || isResizing) {
            // This will trigger the final history save since we drop `overwriteHistory` next time setElements is called
            setElements([...elements]);
        }
        setIsDrawing(false);
        setIsDragging(false);
        setIsResizing(false);
        setResizeDirection(null);
        setDragStartPoint(null);
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Prevent default browser scrolling/zooming behavior
        // NOTE: This usually requires an active `passive: false` event listener at the document scale,
        // but React's synthetic onWheel is somewhat limited for preventing default trackpad pinch zoom.
        // For this simple engine, we'll implement basic scroll-to-pan & ctrl-scroll to zoom.

        if (e.ctrlKey || e.metaKey) {
            // Zooming
            const zoomSensitivity = 0.001;
            setZoom((prevZoom) => {
                const newZoom = prevZoom - e.deltaY * zoomSensitivity;
                return Math.min(Math.max(newZoom, 0.1), 5); // Clamped between 0.1x and 5x
            });
        } else {
            // Panning
            setPanOffset((prev) => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY,
            }));
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (activeTool === 'text' && !writingPosition) {
            const { clientX, clientY } = e;
            const { x, y } = getMouseCoordinates(clientX, clientY);
            const id = elements.length.toString();
            const element = createElement(id, x, y, x, y, 'text', currentColor, currentStrokeWidth, '');
            setElements((prevState) => [...prevState, element]);
            setWritingPosition({ id, x, y });
        }
    };

    const getCursorStyle = () => {
        if (activeTool === 'text') return 'text';
        if (activeTool !== 'select') return 'crosshair';

        if (hoverHandle === 'nw' || hoverHandle === 'se' || resizeDirection === 'nw' || resizeDirection === 'se') {
            return 'nwse-resize';
        }
        if (hoverHandle === 'ne' || hoverHandle === 'sw' || resizeDirection === 'ne' || resizeDirection === 'sw') {
            return 'nesw-resize';
        }

        return 'grab';
    };

    return (
        <div className="w-full h-full relative">
            <canvas
                id="canvas"
                className="w-full h-full bg-slate-50 dark:bg-[#121212] touch-none block"
                style={{ cursor: getCursorStyle() }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onClick={handleClick}
                onWheel={handleWheel}
            />
            {writingPosition && (
                <textarea
                    autoFocus
                    className="absolute m-0 p-0 border-0 outline-none bg-transparent whitespace-pre overflow-hidden resize-none"
                    style={{
                        left: `${writingPosition.x * zoom + panOffset.x}px`,
                        top: `${(writingPosition.y - 28) * zoom + panOffset.y}px`,
                        font: `${28 * zoom}px "Kalam", cursive`,
                        color: currentColor,
                        lineHeight: 1,
                    }}
                    onBlur={(e) => {
                        const text = e.target.value;
                        const elementsCopy = [...elements];
                        const elIndex = elementsCopy.findIndex(el => el.id === writingPosition.id);
                        if (elIndex !== -1) {
                            if (text.trim() === '') {
                                elementsCopy.splice(elIndex, 1);
                            } else {
                                elementsCopy[elIndex] = { ...elementsCopy[elIndex], text };
                            }
                            setElements(elementsCopy);
                        }
                        setWritingPosition(null);
                        setActiveTool('select');
                    }}
                />
            )}
        </div>
    );
}
