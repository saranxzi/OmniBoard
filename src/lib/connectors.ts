import { Element, Point, AnchorSide } from '@/types';

/**
 * Connector utilities — Smart arrows that magnetically snap to shape anchor points.
 * When connected shapes are moved, connectors automatically follow.
 */

/** Get the anchor point for a specific side of an element's bounding box. */
export function getAnchorPoint(el: Element, anchor: AnchorSide): Point {
    const minX = Math.min(el.x1, el.x2);
    const maxX = Math.max(el.x1, el.x2);
    const minY = Math.min(el.y1, el.y2);
    const maxY = Math.max(el.y1, el.y2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    switch (anchor) {
        case 'top':    return { x: cx, y: minY };
        case 'bottom': return { x: cx, y: maxY };
        case 'left':   return { x: minX, y: cy };
        case 'right':  return { x: maxX, y: cy };
        case 'center': 
        default:       return { x: cx, y: cy };
    }
}

/** All possible anchor points for a given element. */
function getAllAnchors(el: Element): { anchor: AnchorSide; point: Point }[] {
    const sides: AnchorSide[] = ['top', 'bottom', 'left', 'right', 'center'];
    return sides.map(anchor => ({ anchor, point: getAnchorPoint(el, anchor) }));
}

/** Distance between two points. */
function dist(a: Point, b: Point): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

const SNAP_RADIUS = 30; // pixels in world space

/**
 * Find the nearest snap-able anchor point from a world-space coordinate.
 * Excludes the connector element itself and optionally an already-connected element.
 */
export function findNearestAnchor(
    point: Point,
    elements: Element[],
    excludeIds: string[] = []
): { elementId: string; anchor: AnchorSide; snapPoint: Point; distance: number } | null {
    let best: { elementId: string; anchor: AnchorSide; snapPoint: Point; distance: number } | null = null;

    for (const el of elements) {
        // Skip non-connectable types
        if (el.type === 'pencil' || el.type === 'text' || el.type === 'eraser' || 
            el.type === 'connector' || el.type === 'image' || excludeIds.includes(el.id)) {
            continue;
        }

        const anchors = getAllAnchors(el);
        for (const { anchor, point: ap } of anchors) {
            const d = dist(point, ap);
            if (d < SNAP_RADIUS && (!best || d < best.distance)) {
                best = { elementId: el.id, anchor, snapPoint: ap, distance: d };
            }
        }
    }

    return best;
}

/**
 * Given a connector element with connection metadata, resolve the actual
 * start and end pixel coordinates based on connected elements' current positions.
 * Falls back to raw x1,y1 / x2,y2 if connection is missing or element not found.
 */
export function resolveConnectorEndpoints(
    connector: Element,
    elements: Element[]
): { start: Point; end: Point } {
    let start: Point = { x: connector.x1, y: connector.y1 };
    let end: Point = { x: connector.x2, y: connector.y2 };

    if (connector.connectedFrom) {
        const fromEl = elements.find(el => el.id === connector.connectedFrom!.elementId);
        if (fromEl) {
            start = getAnchorPoint(fromEl, connector.connectedFrom.anchor);
        }
    }

    if (connector.connectedTo) {
        const toEl = elements.find(el => el.id === connector.connectedTo!.elementId);
        if (toEl) {
            end = getAnchorPoint(toEl, connector.connectedTo.anchor);
        }
    }

    return { start, end };
}

/**
 * Get all connector elements that are connected to a specific element.
 * Used when an element is being moved — we need to update connector endpoints.
 */
export function getConnectorsForElement(elementId: string, elements: Element[]): Element[] {
    return elements.filter(el => 
        el.type === 'connector' && (
            el.connectedFrom?.elementId === elementId || 
            el.connectedTo?.elementId === elementId
        )
    );
}
