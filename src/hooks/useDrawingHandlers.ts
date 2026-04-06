import { useState, useCallback, useRef, useMemo } from 'react';
import { useBoardStore } from '@/store/useBoardStore';
import { Point, Element, ElementLock } from '@/types';
import { getSocket } from '@/lib/socket';
import { getElementAtPosition, createElement, getResizeHandleHit, ResizeHandle } from '@/lib/geometry';
import { simplifyPoints } from '@/lib/simplify';
import { findNearestAnchor } from '@/lib/connectors';
import { snapPoint } from '@/lib/snap';

/**
 * Encapsulates all pointer/drawing interaction logic: creating elements,
 * selecting, dragging, resizing, erasing, panning, zooming, text input,
 * image drag-and-drop, connector snapping, and sticky note editing.
 * Returns event handlers for the canvas + getCursorStyle + writingPosition state.
 */
interface DrawingHandlerOptions {
    lockedElements?: Record<string, ElementLock>;
}

export function useDrawingHandlers(roomId: string, emitCursor: (x: number, y: number) => void, options?: DrawingHandlerOptions) {
    const {
        elements, setElements, activeTool, setActiveTool,
        panOffset, setPanOffset, zoom, setZoom,
        selectedElement, setSelectedElement,
        currentColor, currentStrokeWidth,
        snapToGrid, gridSize
    } = useBoardStore();

    const lockedElements = useMemo(() => options?.lockedElements || {}, [options?.lockedElements]);

    const [isDrawing, setIsDrawing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDirection, setResizeDirection] = useState<ResizeHandle>(null);
    const [hoverHandle, setHoverHandle] = useState<ResizeHandle>(null);
    const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
    const [writingPosition, setWritingPosition] = useState<{ id: string; x: number; y: number } | null>(null);
    // Connector snap preview state
    const [connectorSnapTarget, setConnectorSnapTarget] = useState<{ x: number; y: number } | null>(null);

    // Throttle cursor emit to ~60fps
    const lastCursorEmit = useRef(0);

    const getMouseCoordinates = useCallback((clientX: number, clientY: number) => {
        const raw = {
            x: (clientX - panOffset.x) / zoom,
            y: (clientY - panOffset.y) / zoom,
        };
        return snapToGrid ? snapPoint(raw, gridSize) : raw;
    }, [panOffset, zoom, snapToGrid, gridSize]);

    const generateId = useCallback(() => {
        const els = useBoardStore.getState().elements;
        return els.length > 0 ? (Math.max(...els.map(e => parseInt(e.id) || 0)) + 1).toString() : '0';
    }, []);

    /** Check if an element is locked by someone else */
    const isLockedByOther = useCallback((elementId: string): boolean => {
        const lock = lockedElements[elementId];
        if (!lock) return false;
        return lock.lockedBy !== getSocket().id;
    }, [lockedElements]);

    // ═══════════════════════════════════
    // Image drag-and-drop handlers
    // ═══════════════════════════════════

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (!dataUrl) return;

            const { x, y } = getMouseCoordinates(e.clientX, e.clientY);
            const img = new Image();
            img.onload = () => {
                // Scale down large images to max 400px on longest side
                const maxSize = 400;
                let w = img.width;
                let h = img.height;
                if (w > maxSize || h > maxSize) {
                    const ratio = Math.min(maxSize / w, maxSize / h);
                    w *= ratio;
                    h *= ratio;
                }

                const id = generateId();
                const element = createElement(id, x, y, x + w, y + h, 'image', currentColor, currentStrokeWidth, undefined, {
                    imageDataUrl: dataUrl,
                    imageWidth: w,
                    imageHeight: h,
                });
                setElements((prev) => [...prev, element]);
                getSocket().emit('draw-element', { roomId, element });
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);
    }, [currentColor, currentStrokeWidth, generateId, getMouseCoordinates, roomId, setElements]);

    // ═══════════════════════════════════
    // Pointer event handlers
    // ═══════════════════════════════════

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        const { x, y } = getMouseCoordinates(e.clientX, e.clientY);

        if (activeTool === 'select' || activeTool === 'eraser') {
            if (activeTool === 'select' && selectedElement) {
                const resizeHit = getResizeHandleHit(x, y, selectedElement, zoom);
                if (resizeHit) {
                    if (isLockedByOther(selectedElement.id)) return;
                    setIsResizing(true);
                    setResizeDirection(resizeHit);
                    setDragStartPoint({ x, y });
                    getSocket().emit('lock-element', { roomId, elementId: selectedElement.id });
                    return;
                }
            }

            const hitElement = getElementAtPosition(x, y, elements);

            if (activeTool === 'eraser') {
                if (hitElement) {
                    if (isLockedByOther(hitElement.id)) return;
                    const newElements = elements.filter(el => el.id !== hitElement.id);
                    setElements(newElements);
                    getSocket().emit('erase-element', { roomId, elementId: hitElement.id });
                }
                setIsDrawing(true);
                return;
            }

            setSelectedElement(hitElement);
            if (hitElement) {
                if (isLockedByOther(hitElement.id)) {
                    setSelectedElement(null);
                    return;
                }
                setIsDragging(true);
                setDragStartPoint({ x, y });
                getSocket().emit('lock-element', { roomId, elementId: hitElement.id });
            } else {
                setIsDragging(false);
            }
            return;
        }

        if (activeTool === 'text') return;
        if (activeTool === 'image') return; // Image is handled by drag-and-drop

        setIsDrawing(true);
        const id = generateId();

        if (activeTool === 'connector') {
            // Check for snap-to anchor on start
            const snap = findNearestAnchor({ x, y }, elements);
            const startX = snap ? snap.snapPoint.x : x;
            const startY = snap ? snap.snapPoint.y : y;
            const element = createElement(id, startX, startY, startX, startY, 'connector', currentColor, currentStrokeWidth, undefined, {
                connectedFrom: snap ? { elementId: snap.elementId, anchor: snap.anchor } : undefined,
            });
            setElements((prev) => [...prev, element]);
            getSocket().emit('draw-element', { roomId, element });
        } else if (activeTool === 'sticky') {
            // Default sticky size 200x200
            const element = createElement(id, x, y, x + 200, y + 200, 'sticky', currentColor, currentStrokeWidth, '', {
                stickyColor: '#fef08a',
            });
            setElements((prev) => [...prev, element]);
            getSocket().emit('draw-element', { roomId, element });
            // Immediately open text editor
            setWritingPosition({ id, x, y });
            setIsDrawing(false);
        } else {
            const element = createElement(id, x, y, x, y, activeTool, currentColor, currentStrokeWidth);
            setElements((prev) => [...prev, element]);
            getSocket().emit('draw-element', { roomId, element });
        }
    }, [activeTool, currentColor, currentStrokeWidth, elements, generateId, getMouseCoordinates, isLockedByOther, roomId, selectedElement, setElements, setSelectedElement, zoom]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const { x, y } = getMouseCoordinates(e.clientX, e.clientY);

        // Throttle cursor emit
        const now = Date.now();
        if (now - lastCursorEmit.current > 16) {
            emitCursor(x, y);
            lastCursorEmit.current = now;
        }

        if (activeTool === 'select' || activeTool === 'eraser') {
            // Hover handle detection
            if (activeTool === 'select' && selectedElement && !isDragging && !isResizing && !isDrawing) {
                const hoverHit = getResizeHandleHit(x, y, selectedElement, zoom);
                if (hoverHit !== hoverHandle) setHoverHandle(hoverHit);
            } else if (hoverHandle !== null && !isResizing) {
                setHoverHandle(null);
            }

            // Eraser sweep
            if (activeTool === 'eraser' && isDrawing) {
                const hitElement = getElementAtPosition(x, y, elements);
                if (hitElement && !isLockedByOther(hitElement.id)) {
                    const newElements = elements.filter(el => el.id !== hitElement.id);
                    setElements(newElements, true);
                    getSocket().emit('erase-element', { roomId, elementId: hitElement.id });
                }
                return;
            }

            // Resize
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

                const resizedElement = createElement(el.id, x1, y1, x2, y2, el.type, el.color, el.strokeWidth, el.text, {
                    stickyColor: el.stickyColor,
                    imageDataUrl: el.imageDataUrl,
                    imageWidth: el.imageWidth,
                    imageHeight: el.imageHeight,
                    connectedFrom: el.connectedFrom,
                    connectedTo: el.connectedTo,
                });
                const copy = [...elements];
                copy[index] = resizedElement;
                setElements(copy, true);
                setSelectedElement(resizedElement);
                setDragStartPoint({ x, y });
                getSocket().emit('draw-element', { roomId, element: resizedElement });
                return;
            }

            // Pan or drag
            if (e.buttons === 1 && !isDragging) {
                setPanOffset((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
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
                    movedElement = createElement(el.id, el.x1 + dx, el.y1 + dy, el.x2 + dx, el.y2 + dy, el.type, el.color, el.strokeWidth, el.text, {
                        stickyColor: el.stickyColor,
                        imageDataUrl: el.imageDataUrl,
                        imageWidth: el.imageWidth,
                        imageHeight: el.imageHeight,
                        connectedFrom: el.connectedFrom,
                        connectedTo: el.connectedTo,
                    });
                }

                const copy = [...elements];
                copy[index] = movedElement;
                setElements(copy, true);
                setSelectedElement(movedElement);
                setDragStartPoint({ x, y });
                getSocket().emit('draw-element', { roomId, element: movedElement });
            }
            return;
        }

        // Active drawing
        if (!isDrawing) return;
        const currentElements = useBoardStore.getState().elements;
        const index = currentElements.length - 1;
        if (index < 0) return;

        const currentEl = currentElements[index];
        const { x1, y1, type, points, id } = currentEl;
        let updatedElement: Element;

        if (type === 'pencil') {
            updatedElement = { ...currentEl, points: [...(points || []), { x, y }] };
        } else if (type === 'connector') {
            // Live snap preview for connector endpoint
            const snap = findNearestAnchor({ x, y }, currentElements, [id]);
            const endX = snap ? snap.snapPoint.x : x;
            const endY = snap ? snap.snapPoint.y : y;
            setConnectorSnapTarget(snap ? { x: snap.snapPoint.x, y: snap.snapPoint.y } : null);
            updatedElement = {
                ...currentEl,
                x2: endX,
                y2: endY,
                // Don't set connectedTo yet — only on pointer-up
            };
        } else {
            updatedElement = createElement(id, x1, y1, x, y, type, currentEl.color, currentEl.strokeWidth, currentEl.text, {
                stickyColor: currentEl.stickyColor,
            });
        }

        const copy = [...currentElements];
        copy[index] = updatedElement;
        setElements(copy, true);
        getSocket().emit('draw-element', { roomId, element: updatedElement });
    }, [activeTool, dragStartPoint, elements, emitCursor, getMouseCoordinates, hoverHandle, isDragging, isDrawing, isLockedByOther, isResizing, resizeDirection, roomId, selectedElement, setElements, setPanOffset, setSelectedElement, zoom]);

    const handlePointerUp = useCallback(() => {
        if (isDrawing || isDragging || isResizing) {
            const currentElements = [...useBoardStore.getState().elements];

            if (isDrawing && currentElements.length > 0) {
                const lastIdx = currentElements.length - 1;
                const lastEl = currentElements[lastIdx];

                // Simplify pencil strokes on completion
                if (lastEl.type === 'pencil' && lastEl.points && lastEl.points.length > 2) {
                    const simplified = simplifyPoints(lastEl.points, 1.5);
                    currentElements[lastIdx] = { ...lastEl, points: simplified };
                }

                // Finalize connector — set connectedTo if endpoint is near an anchor
                if (lastEl.type === 'connector') {
                    const snap = findNearestAnchor(
                        { x: lastEl.x2, y: lastEl.y2 },
                        currentElements,
                        [lastEl.id, lastEl.connectedFrom?.elementId || '']
                    );
                    if (snap) {
                        currentElements[lastIdx] = {
                            ...currentElements[lastIdx],
                            x2: snap.snapPoint.x,
                            y2: snap.snapPoint.y,
                            connectedTo: { elementId: snap.elementId, anchor: snap.anchor },
                        };
                    }
                    setConnectorSnapTarget(null);
                }
            }

            // Unlock any locked elements
            if ((isDragging || isResizing) && selectedElement) {
                getSocket().emit('unlock-element', { roomId, elementId: selectedElement.id });
            }

            setElements(currentElements);
            const latestElement = currentElements[currentElements.length - 1];
            if (isDrawing && latestElement) {
                getSocket().emit('draw-element', { roomId, element: latestElement });
            }
        }
        setIsDrawing(false);
        setIsDragging(false);
        setIsResizing(false);
        setResizeDirection(null);
        setDragStartPoint(null);
    }, [isDrawing, isDragging, isResizing, roomId, selectedElement, setElements]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            const zoomSensitivity = 0.001;
            setZoom((prev) => Math.min(Math.max(prev - e.deltaY * zoomSensitivity, 0.1), 5));
        } else {
            setPanOffset((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
        }
    }, [setPanOffset, setZoom]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (activeTool === 'text' && !writingPosition) {
            const { x, y } = getMouseCoordinates(e.clientX, e.clientY);
            const id = generateId();
            const element = createElement(id, x, y, x, y, 'text', currentColor, currentStrokeWidth, '');
            setElements((prev) => [...prev, element]);
            setWritingPosition({ id, x, y });
        }
    }, [activeTool, currentColor, currentStrokeWidth, generateId, getMouseCoordinates, setElements, writingPosition]);

    /** Handle double-click to edit sticky note text */
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        const { x, y } = getMouseCoordinates(e.clientX, e.clientY);
        const hitElement = getElementAtPosition(x, y, elements);
        if (hitElement && hitElement.type === 'sticky') {
            setWritingPosition({ id: hitElement.id, x: hitElement.x1, y: hitElement.y1 });
        }
    }, [elements, getMouseCoordinates]);

    const handleTextBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        if (!writingPosition) return;
        const text = e.target.value;
        const currentElements = useBoardStore.getState().elements;
        const copy = [...currentElements];
        const elIndex = copy.findIndex(el => el.id === writingPosition.id);
        if (elIndex !== -1) {
            const el = copy[elIndex];
            if (el.type === 'text' && text.trim() === '') {
                copy.splice(elIndex, 1);
                getSocket().emit('erase-element', { roomId, elementId: writingPosition.id });
            } else {
                const updated = { ...el, text };
                copy[elIndex] = updated;
                getSocket().emit('draw-element', { roomId, element: updated });
            }
            setElements(copy);
        }
        setWritingPosition(null);
        if (useBoardStore.getState().activeTool === 'text') {
            setActiveTool('select');
        }
    }, [roomId, setActiveTool, setElements, writingPosition]);

    const getCursorStyle = useCallback(() => {
        if (activeTool === 'text') return 'text';
        if (activeTool === 'image') return 'copy';
        if (activeTool !== 'select') return 'crosshair';
        if (hoverHandle === 'nw' || hoverHandle === 'se' || resizeDirection === 'nw' || resizeDirection === 'se') return 'nwse-resize';
        if (hoverHandle === 'ne' || hoverHandle === 'sw' || resizeDirection === 'ne' || resizeDirection === 'sw') return 'nesw-resize';
        return 'grab';
    }, [activeTool, hoverHandle, resizeDirection]);

    return {
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleWheel,
        handleClick,
        handleDoubleClick,
        handleTextBlur,
        handleDragOver,
        handleDrop,
        getCursorStyle,
        writingPosition,
        connectorSnapTarget,
    };
}
