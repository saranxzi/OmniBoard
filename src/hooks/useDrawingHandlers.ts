import { useState, useCallback, useRef } from 'react';
import { useBoardStore, Element, Point } from '@/store/useBoardStore';
import { getSocket } from '@/lib/socket';
import { getElementAtPosition, createElement, getResizeHandleHit, ResizeHandle } from '@/utils/board';

/**
 * Encapsulates all pointer/drawing interaction logic: creating elements,
 * selecting, dragging, resizing, erasing, panning, zooming, and text input.
 * Returns event handlers for the canvas + getCursorStyle + writingPosition state.
 */
export function useDrawingHandlers(roomId: string, emitCursor: (x: number, y: number) => void) {
    const {
        elements, setElements, activeTool, setActiveTool,
        panOffset, setPanOffset, zoom, setZoom,
        selectedElement, setSelectedElement,
        currentColor, currentStrokeWidth
    } = useBoardStore();

    const [isDrawing, setIsDrawing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDirection, setResizeDirection] = useState<ResizeHandle>(null);
    const [hoverHandle, setHoverHandle] = useState<ResizeHandle>(null);
    const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
    const [writingPosition, setWritingPosition] = useState<{ id: string; x: number; y: number } | null>(null);

    // Throttle cursor emit to ~60fps
    const lastCursorEmit = useRef(0);

    const getMouseCoordinates = useCallback((clientX: number, clientY: number) => ({
        x: (clientX - panOffset.x) / zoom,
        y: (clientY - panOffset.y) / zoom,
    }), [panOffset, zoom]);

    const generateId = useCallback(() => {
        const els = useBoardStore.getState().elements;
        return els.length > 0 ? (Math.max(...els.map(e => parseInt(e.id) || 0)) + 1).toString() : '0';
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        const { x, y } = getMouseCoordinates(e.clientX, e.clientY);

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

        if (activeTool === 'text') return;

        setIsDrawing(true);
        const id = generateId();
        const element = createElement(id, x, y, x, y, activeTool, currentColor, currentStrokeWidth);
        setElements((prev) => [...prev, element]);
        getSocket().emit('draw-element', { roomId, element });
    }, [activeTool, currentColor, currentStrokeWidth, elements, generateId, getMouseCoordinates, roomId, selectedElement, setElements, setSelectedElement, zoom]);

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
                if (hitElement) {
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

                const resizedElement = createElement(el.id, x1, y1, x2, y2, el.type, el.color, el.strokeWidth, el.text);
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
                    movedElement = createElement(el.id, el.x1 + dx, el.y1 + dy, el.x2 + dx, el.y2 + dy, el.type, el.color, el.strokeWidth, el.text);
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

        const { x1, y1, type, points, id } = currentElements[index];
        let updatedElement: Element;

        if (type === 'pencil') {
            updatedElement = { ...currentElements[index], points: [...(points || []), { x, y }] };
        } else {
            updatedElement = createElement(id, x1, y1, x, y, type, currentElements[index].color, currentElements[index].strokeWidth, currentElements[index].text);
        }

        const copy = [...currentElements];
        copy[index] = updatedElement;
        setElements(copy, true);
        getSocket().emit('draw-element', { roomId, element: updatedElement });
    }, [activeTool, dragStartPoint, elements, emitCursor, getMouseCoordinates, hoverHandle, isDragging, isDrawing, isResizing, resizeDirection, roomId, selectedElement, setElements, setPanOffset, setSelectedElement, zoom]);

    const handlePointerUp = useCallback(() => {
        if (isDrawing || isDragging || isResizing) {
            setElements([...useBoardStore.getState().elements]);
            const latestElements = useBoardStore.getState().elements;
            const latestElement = latestElements[latestElements.length - 1];
            if (isDrawing && latestElement) {
                getSocket().emit('draw-element', { roomId, element: latestElement });
            }
        }
        setIsDrawing(false);
        setIsDragging(false);
        setIsResizing(false);
        setResizeDirection(null);
        setDragStartPoint(null);
    }, [isDrawing, isDragging, isResizing, roomId, setElements]);

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

    const handleTextBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
        if (!writingPosition) return;
        const text = e.target.value;
        const currentElements = useBoardStore.getState().elements;
        const copy = [...currentElements];
        const elIndex = copy.findIndex(el => el.id === writingPosition.id);
        if (elIndex !== -1) {
            if (text.trim() === '') {
                copy.splice(elIndex, 1);
                getSocket().emit('erase-element', { roomId, elementId: writingPosition.id });
            } else {
                const updated = { ...copy[elIndex], text };
                copy[elIndex] = updated;
                getSocket().emit('draw-element', { roomId, element: updated });
            }
            setElements(copy);
        }
        setWritingPosition(null);
        setActiveTool('select');
    }, [roomId, setActiveTool, setElements, writingPosition]);

    const getCursorStyle = useCallback(() => {
        if (activeTool === 'text') return 'text';
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
        handleTextBlur,
        getCursorStyle,
        writingPosition,
    };
}
