import { Point } from '@/types';

/**
 * Ramer-Douglas-Peucker line simplification algorithm.
 * Reduces the number of points in a polyline while preserving visual shape.
 * Typically reduces pencil stroke data by ~70-85% without visible quality loss.
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;

    // If lineStart and lineEnd are the same point, just return distance
    const lineLenSq = dx * dx + dy * dy;
    if (lineLenSq === 0) {
        return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    }

    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLenSq;
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;

    return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Ramer-Douglas-Peucker algorithm — recursively simplifies a polyline.
 * @param points - Array of points to simplify
 * @param epsilon - Maximum allowed perpendicular deviation. Lower = more detail. Default 1.5px.
 * @returns Simplified array of points
 */
export function simplifyPoints(points: Point[], epsilon: number = 1.5): Point[] {
    if (points.length <= 2) return points;

    // Find the point with the maximum distance from the line between first and last
    let maxDist = 0;
    let maxIndex = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const dist = perpendicularDistance(points[i], start, end);
        if (dist > maxDist) {
            maxDist = dist;
            maxIndex = i;
        }
    }

    // If the max distance exceeds epsilon, recursively simplify both halves
    if (maxDist > epsilon) {
        const left = simplifyPoints(points.slice(0, maxIndex + 1), epsilon);
        const right = simplifyPoints(points.slice(maxIndex), epsilon);
        // Remove duplicate middle point
        return [...left.slice(0, -1), ...right];
    }

    // All points are within epsilon — just keep endpoints
    return [start, end];
}
