import { Point } from '@/types';

/**
 * Grid snapping utilities — snaps points to the nearest grid intersection.
 * Used when snapToGrid is enabled for precise shape placement.
 */

/**
 * Snap a point to the nearest grid intersection.
 * @param point - The point to snap
 * @param gridSize - Grid cell size in pixels (default 40)
 * @returns Snapped point
 */
export function snapPoint(point: Point, gridSize: number = 40): Point {
    return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
    };
}

/**
 * Snap a value to the nearest grid line.
 */
export function snapValue(value: number, gridSize: number = 40): number {
    return Math.round(value / gridSize) * gridSize;
}
