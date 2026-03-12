import { useEffect } from 'react';
import { useBoardStore, Tool } from '@/store/useBoardStore';
import { getSocket } from '@/lib/socket';

/** Maps single-key shortcuts to tool types */
const TOOL_SHORTCUTS: Record<string, Tool> = {
    v: 'select',
    p: 'pencil',
    l: 'line',
    a: 'arrow',
    r: 'rectangle',
    o: 'ellipse',
    d: 'diamond',
    t: 'text',
    e: 'eraser',
};

/**
 * Handles all keyboard shortcuts:
 * - Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y for undo/redo
 * - Delete/Backspace to remove selected element
 * - Single letter keys (V,P,L,A,R,O,D,T,E) to switch tools
 */
export function useKeyboardShortcuts(roomId: string) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore shortcuts when typing in inputs
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    useBoardStore.getState().redo();
                } else {
                    useBoardStore.getState().undo();
                }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                useBoardStore.getState().redo();
                return;
            }

            // Delete selected element
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const { selectedElement, elements, setElements, setSelectedElement } = useBoardStore.getState();
                if (selectedElement) {
                    e.preventDefault();
                    setElements(elements.filter(el => el.id !== selectedElement.id));
                    setSelectedElement(null);
                    getSocket().emit('erase-element', { roomId, elementId: selectedElement.id });
                }
                return;
            }

            // Escape to deselect
            if (e.key === 'Escape') {
                useBoardStore.getState().setSelectedElement(null);
                return;
            }

            // Tool shortcuts (single letters, no modifier keys)
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
                if (tool) {
                    useBoardStore.getState().setActiveTool(tool);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [roomId]);
}
