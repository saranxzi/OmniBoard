import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { Tool, Point, Element } from '@/types';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;

interface BoardState {
    activeTool: Tool;
    currentColor: string;
    currentStrokeWidth: number;
    elements: Element[];
    history: Element[][];
    historyIndex: number;
    panOffset: Point;
    zoom: number;
    selectedElement: Element | null;
    isDarkMode: boolean;
    snapToGrid: boolean;
    gridSize: number;
    showMinimap: boolean;
    setActiveTool: (tool: Tool) => void;
    setCurrentColor: (color: string) => void;
    setCurrentStrokeWidth: (width: number) => void;
    setElements: (elements: Element[] | ((prev: Element[]) => Element[]), overwriteHistory?: boolean) => void;
    setPanOffset: (offset: Point | ((prev: Point) => Point)) => void;
    setZoom: (zoom: number | ((prev: number) => number)) => void;
    setSelectedElement: (element: Element | null) => void;
    toggleDarkMode: () => void;
    setSnapToGrid: (snap: boolean) => void;
    setGridSize: (size: number) => void;
    setShowMinimap: (show: boolean) => void;
    undo: () => void;
    redo: () => void;
    clearCanvas: () => void;
}

export const useBoardStore = create<BoardState>()(
    persist(
        (set) => ({
            activeTool: 'pencil',
            currentColor: '#424874', // theme-dark
            currentStrokeWidth: 4,
            elements: [],
            history: [[]],
            historyIndex: 0,
            panOffset: { x: 0, y: 0 },
            zoom: 1,
            selectedElement: null,
            isDarkMode: false,
            snapToGrid: false,
            gridSize: 40,
            showMinimap: false,
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
            toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
            setSnapToGrid: (snap) => set({ snapToGrid: snap }),
            setGridSize: (size) => set({ gridSize: size }),
            setShowMinimap: (show) => set({ showMinimap: show }),
            setElements: (elements, overwriteHistory = false) =>
                set((state) => {
                    const nextElements = typeof elements === 'function' ? elements(state.elements) : elements;

                    if (overwriteHistory) {
                        const historyCopy = [...state.history];
                        historyCopy[state.historyIndex] = nextElements;
                        return { elements: nextElements, history: historyCopy };
                    }

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
        }),
        {
            name: 'omniboard-preferences',
            // Only persist preferences, not canvas state
            partialize: (state) => ({
                isDarkMode: state.isDarkMode,
                snapToGrid: state.snapToGrid,
                gridSize: state.gridSize,
                showMinimap: state.showMinimap,
                currentColor: state.currentColor,
                currentStrokeWidth: state.currentStrokeWidth,
            }),
        }
    )
);
