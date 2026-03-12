'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Drawable } from 'roughjs/bin/core';
import { useBoardStore, Element, Point, Tool } from '@/store/useBoardStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getSocket } from '@/lib/socket';
import getStroke from 'perfect-freehand';
import {
    distance, isPointOnLine, getElementAtPosition,
    getSvgPathFromStroke, createElement, getResizeHandleHit, ResizeHandle
} from '@/utils/board';
import rough from 'roughjs';
import { motion, AnimatePresence } from 'framer-motion';

export default function Board() {
    const params = useParams();
    const roomId = params.roomId as string;
    const { user } = useAuthStore();

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
    
    // Multiplayer Cursors
    const [cursors, setCursors] = useState<Record<string, { socketId: string, x: number, y: number, user: any }>>({});

    // WebSocket Initialization
    useEffect(() => {
        const socket = getSocket();
        socket.connect();
        
        socket.emit('join-room', roomId);

        socket.on('init-room', (serverElements: Element[]) => {
            setElements(serverElements);
        });

        socket.on('update-element', (element: Element) => {
            setElements((prev) => {
                const index = prev.findIndex(el => el.id === element.id);
                if (index !== -1) {
                    const newElements = [...prev];
                    newElements[index] = element;
                    return newElements;
                }
                return [...prev, element];
            }, true);
        });

        socket.on('remove-element', (elementId: string) => {
            setElements((prev) => prev.filter(el => el.id !== elementId), true);
            // Also deselect if it was the selected element
            if (useBoardStore.getState().selectedElement?.id === elementId) {
                setSelectedElement(null);
            }
        });

        socket.on('canvas-cleared', () => {
            setElements([], true);
            setSelectedElement(null);
        });

        socket.on('cursor-update', (data) => {
            setCursors(prev => ({ ...prev, [data.socketId]: data }));
            // Optional: Automatically remove cursors after inactivity
            // Clear timeout logic would go here
        });

        return () => {
            socket.disconnect();
            socket.off('init-room');
            socket.off('update-element');
            socket.off('remove-element');
            socket.off('canvas-cleared');
            socket.off('cursor-update');
        };
    }, [roomId, setElements, setSelectedElement]);

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

        const GRID_SIZE = 40 * zoom;
        const offsetX = panOffset.x % GRID_SIZE;
        const offsetY = panOffset.y % GRID_SIZE;

        ctx.fillStyle = '#DCD6F7'; // theme-light

        for (let x = offsetX; x < canvas.width; x += GRID_SIZE) {
            for (let y = offsetY; y < canvas.height; y += GRID_SIZE) {
                ctx.beginPath();
                ctx.arc(x, y, 1.5 * Math.min(Math.max(zoom, 0.5), 2), 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.translate(panOffset.x, panOffset.y);
        ctx.scale(zoom, zoom);

        const rc = rough.canvas(canvas);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const getThemeAwareColor = (color: string) => {
            if (color === '#424874') return '#424874';
            return color;
        };

        elements.forEach((element) => {
            const displayColor = getThemeAwareColor(element.color);

            if (element.type === 'pencil' && element.points) {
                const stroke = getStroke(element.points.map(p => [p.x, p.y]), {
                    size: element.strokeWidth / zoom,
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
                const originalOptions = element.roughElement.options;
                const tempOptions = { ...originalOptions, stroke: displayColor };

                element.roughElement.sets.forEach(() => {
                    rc.draw({ ...element.roughElement, options: tempOptions } as Drawable);
                });
            }

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
                ctx.strokeStyle = '#A6B1E1'; // theme-accent
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
                    // Optional: emit full board state sync or reverse ops on undo
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
            setElements((prev) => [...prev]);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [setElements]);

    const handlePointerDown = (e: React.PointerEvent) => {
        const { clientX, clientY } = e;
        const { x, y } = getMouseCoordinates(clientX, clientY);

        if (activeTool === 'select' || activeTool === 'eraser') {

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
                    getSocket().emit('erase-element', { roomId, elementId: hitElement.id });
                }
                setIsDrawing(true);
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

        const id = elements.length > 0 ? (Math.max(...elements.map(e => parseInt(e.id) || 0)) + 1).toString() : '0';
        const element = createElement(id, x, y, x, y, activeTool, currentColor, currentStrokeWidth);
        setElements((prevState) => [...prevState, element]);
        getSocket().emit('draw-element', { roomId, element });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const { clientX, clientY } = e;
        const { x, y } = getMouseCoordinates(clientX, clientY);

        // Emit cursor position for multiplayer
        if (user) {
            getSocket().emit('cursor-move', { roomId, user, x, y });
        }

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
                    setElements(newElements, true);
                    getSocket().emit('erase-element', { roomId, elementId: hitElement.id });
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
                
                getSocket().emit('draw-element', { roomId, element: resizedElement });
                return;
            }

            if (e.buttons === 1 && !isDragging) {
                setPanOffset((prev) => ({
                    x: prev.x + e.movementX,
                    y: prev.y + e.movementY,
                }));
            } else if (isDragging && selectedElement && dragStartPoint) {
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

                setElements(elementsCopy, true);
                setSelectedElement(movedElement);
                setDragStartPoint({ x, y });
                
                getSocket().emit('draw-element', { roomId, element: movedElement });
            }
            return;
        }

        if (!isDrawing) return;

        const index = elements.length - 1;
        const { x1, y1, type, points, id } = elements[index];

        let updatedElement: Element;

        if (type === 'pencil') {
            updatedElement = {
                ...elements[index],
                points: [...(points || []), { x, y }]
            };
        } else {
            updatedElement = createElement(id, x1, y1, x, y, type, elements[index].color, elements[index].strokeWidth, elements[index].text);
        }

        const elementsCopy = [...elements];
        elementsCopy[index] = updatedElement;
        setElements(elementsCopy, true);
        
        // Emit during drawing to show live updates to others
        getSocket().emit('draw-element', { roomId, element: updatedElement });
    };

    const handlePointerUp = () => {
        if (isDrawing || isDragging || isResizing) {
            setElements([...elements]);
            // Ensure final form of dragged/drawn element is synced
            const latestElement = elements[elements.length - 1];
            if (isDrawing && latestElement) {
                getSocket().emit('draw-element', { roomId, element: latestElement });
            }
        }
        setIsDrawing(false);
        setIsDragging(false);
        setIsResizing(false);
        setResizeDirection(null);
        setDragStartPoint(null);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            const zoomSensitivity = 0.001;
            setZoom((prevZoom) => {
                const newZoom = prevZoom - e.deltaY * zoomSensitivity;
                return Math.min(Math.max(newZoom, 0.1), 5);
            });
        } else {
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
            const id = elements.length > 0 ? (Math.max(...elements.map(e => parseInt(e.id) || 0)) + 1).toString() : '0';
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
                className="w-full h-full bg-theme-lightest touch-none block"
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
                                getSocket().emit('erase-element', { roomId, elementId: writingPosition.id });
                            } else {
                                const updated = { ...elementsCopy[elIndex], text };
                                elementsCopy[elIndex] = updated;
                                getSocket().emit('draw-element', { roomId, element: updated });
                            }
                            setElements(elementsCopy);
                        }
                        setWritingPosition(null);
                        setActiveTool('select');
                    }}
                />
            )}

            {/* Live Cursors Overlay */}
            <AnimatePresence>
                {Object.values(cursors).map(cursor => (
                    <motion.div
                        key={cursor.socketId}
                        initial={{ opacity: 0 }}
                        animate={{ 
                            opacity: 1,
                            x: cursor.x * zoom + panOffset.x,
                            y: cursor.y * zoom + panOffset.y,
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "tween", ease: "linear", duration: 0.1 }}
                        className="absolute top-0 left-0 pointer-events-none z-40 flex flex-col items-start"
                    >
                        {/* Cursor Icon */}
                        <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
                            <path d="M5.65376 2.15376C5.40539 1.55169 4.59461 1.55168 4.34624 2.15376L0.264426 12.046C0.0305603 12.613 0.449195 13.2384 1.05602 13.2384H3V17.5C3 18.3284 3.67157 19 4.5 19H5.5C6.32843 19 7 18.3284 7 17.5V13.2384H8.94398C9.55081 13.2384 9.96944 12.613 9.73557 12.046L5.65376 2.15376Z" fill="#A6B1E1" stroke="white" strokeWidth="1.5" />
                        </svg>
                        
                        {/* User Name Tag */}
                        <div className="bg-theme-accent text-white text-xs font-bold px-2 py-0.5 rounded-br-lg rounded-bl-lg rounded-tr-lg shadow-sm whitespace-nowrap -mt-2 ml-4">
                            {cursor.user?.name || 'Guest'}
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
