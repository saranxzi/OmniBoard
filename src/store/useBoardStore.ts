import { create } from 'zustand';
import { Drawable } from 'roughjs/bin/core';

export type Tool = 'select' | 'rectangle' | 'line' | 'pencil' | 'text' | 'eraser';

export type Point = { x: number; y: number };

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

export type Element = {
    id: string;
    type: Tool;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    strokeWidth: number;
    text?: string;
    roughElement?: Drawable; // Cache the rough.js shape
    points?: Point[];        // Store points for perfect-freehand
};

interface BoardState {
    theme: 'light' | 'dark';
    activeTool: Tool;
    currentColor: string;
    currentStrokeWidth: number;
    elements: Element[];
    history: Element[][];
    historyIndex: number;
    panOffset: Point;
    zoom: number;
    selectedElement: Element | null;
    setTheme: (theme: 'light' | 'dark') => void;
    toggleTheme: () => void;
    setActiveTool: (tool: Tool) => void;
    setCurrentColor: (color: string) => void;
    setCurrentStrokeWidth: (width: number) => void;
    setElements: (elements: Element[] | ((prev: Element[]) => Element[]), overwriteHistory?: boolean) => void;
    setPanOffset: (offset: Point | ((prev: Point) => Point)) => void;
    setZoom: (zoom: number | ((prev: number) => number)) => void;
    setSelectedElement: (element: Element | null) => void;
    undo: () => void;
    redo: () => void;
    clearCanvas: () => void;
}

export const useBoardStore = create<BoardState>((set) => ({
    theme: 'light',
    activeTool: 'pencil',
    currentColor: '#1e293b', // slate-800
    currentStrokeWidth: 4,
    elements: [],
    history: [[]],
    historyIndex: 0,
    panOffset: { x: 0, y: 0 },
    zoom: 1,
    selectedElement: null,
    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    setActiveTool: (tool) => set({ activeTool: tool, selectedElement: null }),
    setCurrentColor: (color) => set({ currentColor: color }),
    setCurrentStrokeWidth: (width) => set({ currentStrokeWidth: width }),
    setPanOffset: (offset) => set((state) => ({
        panOffset: typeof offset === 'function' ? offset(state.panOffset) : offset
    })),
    setZoom: (zoom) => set((state) => ({
        zoom: typeof zoom === 'function' ? zoom(state.zoom) : zoom
    })),
    setSelectedElement: (element) => set({ selectedElement: element }),
    setElements: (elements, overwriteHistory = false) =>
        set((state) => {
            const nextElements = typeof elements === 'function' ? elements(state.elements) : elements;

            if (overwriteHistory) {
                // Just update elements without creating a new history step (useful during active drawing drag)
                const historyCopy = [...state.history];
                historyCopy[state.historyIndex] = nextElements;
                return { elements: nextElements, history: historyCopy };
            }

            // We finished a stroke/shape, push to history
            const nextHistory = [...state.history].slice(0, state.historyIndex + 1);
            nextHistory.push(nextElements);

            return {
                elements: nextElements,
                history: nextHistory,
                historyIndex: nextHistory.length - 1,
            };
        }),
    undo: () => set((state) => {
        if (state.historyIndex > 0) {
            return {
                historyIndex: state.historyIndex - 1,
                elements: state.history[state.historyIndex - 1]
            };
        }
        return state;
    }),
    redo: () => set((state) => {
        if (state.historyIndex < state.history.length - 1) {
            return {
                historyIndex: state.historyIndex + 1,
                elements: state.history[state.historyIndex + 1]
            };
        }
        return state;
    }),
    clearCanvas: () => set((state) => ({
        elements: [],
        history: [...state.history.slice(0, state.historyIndex + 1), []],
        historyIndex: state.historyIndex + 1,
        selectedElement: null
    }))
}));
