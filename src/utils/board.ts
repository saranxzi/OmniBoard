import rough from 'roughjs';
import { Drawable } from 'roughjs/bin/core';
import getStroke from 'perfect-freehand';
import { Element, Point, Tool } from '@/store/useBoardStore';

const generator = rough.generator();

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | null;

export const distance = (a: Point, b: Point) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

export const isPointOnLine = (x1: number, y1: number, x2: number, y2: number, x: number, y: number, maxDistance = 1) => {
    const a = { x: x1, y: y1 };
    const b = { x: x2, y: y2 };
    const c = { x, y };
    const offset = distance(a, b) - (distance(a, c) + distance(b, c));
    return Math.abs(offset) < maxDistance;
};

export const getElementAtPosition = (x: number, y: number, elements: Element[]): Element | null => {
    // Loop backwards to hit the top-most element first
    for (let i = elements.length - 1; i >= 0; i--) {
        const element = elements[i];
        const { x1, y1, x2, y2, type, points } = element;

        if (type === 'rectangle') {
            const minX = Math.min(x1, x2);
            const maxX = Math.max(x1, x2);
            const minY = Math.min(y1, y2);
            const maxY = Math.max(y1, y2);
            if (x >= minX && x <= maxX && y >= minY && y <= maxY) return element;
        } else if (type === 'line') {
            if (isPointOnLine(x1, y1, x2, y2, x, y, 5)) return element;
        } else if (type === 'pencil' && points) {
            // For pencil, check if point is near any of the stroke points
            const isHit = points.some(point => distance(point, { x, y }) < 10);
            if (isHit) return element;
        } else if (type === 'text' && element.text) {
            // Very rough hit detection for text
            const width = element.text.length * 14;
            const height = 24;
            if (x >= x1 && x <= x1 + width && y >= y1 - height && y <= y1) return element;
        }
    }
    return null;
};

export function getSvgPathFromStroke(stroke: number[][]) {
    if (!stroke.length) return '';

    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ['M', ...stroke[0], 'Q']
    );

    d.push('Z');
    return d.join(' ');
}

export function createElement(
    id: string, x1: number, y1: number, x2: number, y2: number,
    type: string, color: string, strokeWidth: number, text?: string
): Element {
    if (type === 'pencil') {
        return { id, type: 'pencil', x1, y1, x2, y2, color, strokeWidth, points: [{ x: x1, y: y1 }] };
    } else if (type === 'text') {
        return { id, type: 'text', x1, y1, x2, y2, color, strokeWidth, text: text || '' };
    }

    let roughElement;
    if (type === 'rectangle') {
        roughElement = generator.rectangle(x1, y1, x2 - x1, y2 - y1, {
            stroke: color,
            strokeWidth: strokeWidth,
            roughness: 1.5,
        });
    } else if (type === 'line') {
        roughElement = generator.line(x1, y1, x2, y2, {
            stroke: color,
            strokeWidth: strokeWidth,
            roughness: 1.5,
        });
    }

    return { id, type: type as Tool, x1, y1, x2, y2, color, strokeWidth, text, roughElement };
}

// Check if a given coordinate is clicking inside an 8x8 resize handle of the selected element
export const getResizeHandleHit = (x: number, y: number, element: Element, zoom: number): ResizeHandle => {
    // We don't support resizing pencil strokes or text directly yet (only shapes & lines)
    if (element.type === 'pencil' || element.type === 'text') return null;

    const { x1, y1, x2, y2 } = element;
    const handleSize = 8 / zoom; // Match the visual size of the drawn handles

    // Check hit purely by bounds intersection
    const isInside = (hx: number, hy: number) => {
        return Math.abs(x - hx) <= handleSize && Math.abs(y - hy) <= handleSize;
    };

    if (isInside(x1, y1)) return 'nw';
    if (isInside(x2, y1)) return 'ne';
    if (isInside(x1, y2)) return 'sw';
    if (isInside(x2, y2)) return 'se';

    return null;
};
