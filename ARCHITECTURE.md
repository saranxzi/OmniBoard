# OmniBoard Architecture & Implementation Analysis

This document provides a comprehensive breakdown of the OmniBoard project's current state, the technology stack chosen, the rationale behind those choices, and how the various components interact to create a high-performance, infinite-canvas whiteboard.

---

## 1. Technology Stack & Rationale

We selected a modern, highly performant stack tailored for a client-side heavy, highly interactive drawing application:

### **Next.js 14 (React)**
*   **Why**: Provides a robust foundation with file-based routing, excellent developer experience (fast refresh), and future-proofs the app for any SEO or server-side rendering needs (such as landing pages or lobbies).
*   **Usage**: We heavily utilize Next.js App Router. However, because `<canvas>` and window objects require browser APIs, the core drawing engine (`Board.tsx`) is dynamically imported with `ssr: false` in `page.tsx` to prevent server-side rendering errors.

### **Zustand (State Management)**
*   **Why**: In a canvas app, state updates happen 60 times a second (e.g., dragging the mouse). React's built-in `Context API` would cause the entire application string of components to re-render, destroying performance. Zustand is lightweight, avoids boilerplate, and allows components to subscribe *only* to the specific state slices they need. Furthermore, Zustand state can be accessed *outside* of React components if needed.
*   **Usage**: The entire application state (Elements, Undo/Redo history, Zoom, Pan Offset, Active Tool, Theme) lives in `src/store/useBoardStore.ts`.

### **Tailwind CSS**
*   **Why**: Allows rapid UI development through utility classes without leaving the JSX. It makes implementing complex styles like Glassmorphism (`backdrop-blur`) and Dark Mode trivial.
*   **Usage**: Extensively used across UI overlays (`Toolbar.tsx`, `UndoRedo.tsx`). It natively handles the `dark:` theme switching based on a class strategy attached to the `<html>` tag.

### **HTML5 Canvas**
*   **Why**: Rendering thousands of shapes (lines, rectangles, freehand strokes) using standard DOM elements (`<div>` or `<svg>`) quickly chokes the browser's paint engine. HTML5 `<canvas>` provides immediate-mode, raw pixel-pushing performance which is essential for infinite panning and zooming.
*   **Usage**: The sole rendering surface in `Board.tsx`.

### **Rough.js**
*   **Why**: To match the signature "Excalidraw" aesthetic. It mathematically generates paths that look like they were sketched by hand.
*   **Usage**: Used to draw lines and rectangles.

### **Perfect-Freehand**
*   **Why**: Rough.js doesn't handle continuous smooth freehand drawing well out of the box. `perfect-freehand` takes an array of raw mouse pointer dots and calculates a flawless, teardrop-style SVG Path2D with simulated pressure and thinning.
*   **Usage**: Powers the `pencil` tool.

### **Lucide-React & next/font/google**
*   **Why**: Beautiful, modern UI artifacts.
*   **Usage**: Lucide for icons (Trash, Undo, Rectangles). `Kalam` from Google Fonts to give text elements a handwritten vibe.

---

## 2. Core Implementation Details

The application is split between **State (Logic)** and **The View (Board + UI)**.

### A. Global State (`useBoardStore.ts`)
The Zustand store acts as the single source of truth. 
*   **The Element Array**: Every item on the canvas is an `Element`. It knows its `id`, `type` (pencil, text, rectangle, etc), bounds (`x1`, `y1`, `x2`, `y2`), color, and thickness. 
*   **Caching Math**: Generating a `rough.js` sketchy outline involves heavy math. To prevent calculating this 60 times a second, the resulting `roughElement` is cached directly inside the `Element` object when the user finishes drawing it.
*   **Undo/Redo History**: Handled by storing snapshots of the `elements` array in a chronological 2D array (`history`).

### B. The Render Loop (`Board.tsx`)
Because standard React isn't fast enough for Canvas, we use a `useLayoutEffect` hook that clears the canvas and redraws everything from scratch on every state change.

1.  **Coordinate Math & Viewport Transform**: 
    The browser tells us the mouse clicked at screen pixel `(100, 100)`. But if the user has zoomed in by 200% and panned left by 500 pixels, the *actual* place on the infinite board they clicked is entirely different.
    We use mathematical translation `ctx.translate(panOffset.x, panOffset.y)` and `ctx.scale(zoom, zoom)` so we just draw elements at their raw data coordinates, and the canvas handles shifting the "camera" natively.
2.  **The Infinite Dot Grid**:
    We calculate the visible screen boundaries based on current pan and zoom, and use a modulo loop to only draw dots precisely where the camera is looking.
3.  **Drawing Shapes**:
    We loop over `elements`. If it's `roughElement`, we tell RoughJS to paint it. If it's a `pencil`, we generate the Path2D via Perfect-Freehand and fill it natively. If it's `text`, we use `ctx.fillText`.

### C. Interaction Logic (Mouse Events)
The `onPointerDown`, `onPointerMove`, and `onPointerUp` events dictate the logic.
*   **Hit Detection**: If the active tool is `select` or `eraser`, clicking triggers a math function `getElementAtPosition`. It loops backwards through elements (so it hits the "top" layer first), using linear algebra to determine if the pointer `(x, y)` touches a line segment, falls inside a rectangle bounds, or intersects the bounding box of a freehand pencil shape.
*   **Optimized Dragging**: When dragging a shape, we don't save every tiny fractional movement to the Undo History (otherwise pressing Undo would just move the shape 1 pixel). We bypass the history queue via a boolean flag `overwriteHistory = true` during `mousemove`, and only push the final resting spot to the Undo History array on `mouseup`.

### D. The Polished Features
*   **Dynamically Inverted Dark Mode:** The canvas stores pencil strokes in Dark Slate (`#1e293b`). When Dark Mode toggles, the `getThemeAwareColor` helper dynamically commands the render loop to paint those shapes as White (`#f8fafc`). The *data* is still Slate, but the *render* is inverted. This preserves data integrity while offering seamless dark mode.
*   **Export as PNG (`ExportImage.tsx`):** We cannot simply export the visible canvas, because the canvas background is actually fully transparent (the color you see is the `html`/`body` CSS background behind the canvas). To solve this, clicking Export creates an invisible "Off-Screen" canvas, fills it completely with the Dark or Light background color, stamps your drawing exactly on top of it, and generates a downloadable PNG text string (dataURL).
*   **Text Tool Fixes:** The HTML `<textarea>` used for typing relies on the browser DOM, not the Canvas. It's perfectly positioned absolutely over the canvas using the Math bounds tracking Zoom and Pan, creating a seamless illusion.

### E. Technical Deep-Dives (The "How-To")

Here are specific examples of the mathematics and mechanics powering the engine:

#### 1. Infinite Canvas & Viewport Translation
Instead of using CSS `transform` on a massive HTML element, we natively manipulate the HTML5 Canvas 2D context matrix. Every time the user scrolls their mouse wheel, we update the `zoom` and `panOffset` in the Zustand store.

Before we draw any shapes in `.forEach()`, we shift the "camera" of the canvas:
```typescript
useLayoutEffect(() => {
    // ... setup canvas
    ctx.save();
    
    // Shift the entire canvas's 0,0 origin by our camera offset
    ctx.translate(panOffset.x, panOffset.y);
    
    // Scale all subsequent drawing operations natively
    ctx.scale(zoom, zoom);
    
    // Now we can draw a shape at its raw world coordinates (e.g., x: 100, y: 100) 
    // and the canvas automatically places it securely in our viewport field of vision.
    elements.forEach(element => { /* draw logic */ });
    
    ctx.restore();
}, [zoom, panOffset, elements])
```

#### 2. Advanced Hit Detection (Select & Eraser Tools)
When you click on the canvas, we need to know if you touched a shape. We can't use DOM `onClick` because these are just pixels. We loop backwards through the `elements` array (to hit the top-most shape first) and run geometric math.

For a **Line** shape, we use the Triangle Inequality Theorem to check if the distance from the pointer `(x, y)` to both ends of the line segment is roughly equal to the line's total length (plus a tiny thickness buffer).

```typescript
// src/utils/board.ts
export const distance = (a: Point, b: Point) => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

export const isPointOnLine = (x1: number, y1: number, x2: number, y2: number, x: number, y: number, maxDistance = 5) => {
    const a = { x: x1, y: y1 };
    const b = { x: x2, y: y2 };
    const c = { x, y }; // Mouse pointer
    
    // If distance(a,c) + distance(b,c) === distance(a,b), the point C is perfectly on the line AB.
    const offset = distance(a, b) - (distance(a, c) + distance(b, c));
    return Math.abs(offset) < maxDistance;
};
```

#### 3. Shape Resizing & Handle Hit Detection
When an element is selected, we draw 4 mathematical 8x8 squares at its corners. We detect if the user clicked one by comparing their mouse coordinate intersection:

```typescript
// src/utils/board.ts
export const getResizeHandleHit = (x: number, y: number, element: Element, zoom: number): ResizeHandle => {
    const { x1, y1, x2, y2 } = element;
    const handleSize = 8 / zoom; // Keeps the handle a consistent size on the screen regardless of zoom

    // Is mouse (x,y) inside this corner bounding box?
    const isInside = (hx: number, hy: number) => {
        return Math.abs(x - hx) <= handleSize && Math.abs(y - hy) <= handleSize;
    };

    if (isInside(x1, y1)) return 'nw'; // NorthWest
    if (isInside(x2, y2)) return 'se'; // SouthEast
    // ...
    return null;
};
```
During the `onPointerMove` event, if `isResizing === true`, we calculate the vector delta `dx/dy` from the drag start point and directly mutate the specific coordinate boundaries of the shape:
```typescript
if (resizeDirection === 'nw') { 
    x1 += dx; // Expand top left corner out
    y1 += dy; 
}
// Then re-feed x1/y1 into Rough.js generator to create a new shape at the new dimensions
```

#### 4. The Eraser Tool implementation
Once hit-detection was solved (see #2), erasing became trivial array manipulation inside `Board.tsx`'s `handlePointerMove`.
```typescript
if (activeTool === 'eraser' && isDrawing) {
    const hitElement = getElementAtPosition(x, y, elements);
    if (hitElement) {
        // Filter out the shape that the eraser just intersected with
        const newElements = elements.filter(el => el.id !== hitElement.id);
        
        // Push state, using overwriteHistory=true to prevent a 
        // thousand history steps being saved while dragging the eraser
        setElements(newElements, true); 
    }
}
```

---

## 3. Future Implementation Blueprint (Phase 2: Multiplayer)

While the backend logic is currently paused in favor of local polish, the engine was specifically built to scale seamlessly into a real-time collaborative tool (Phase 2).

1.  **Backend Choice**: A separate Node.js / Express server using `socket.io`. (Next.js serverless functions cannot handle persistent WebSocket connections).
2.  **Rooms**: `Map<string, Element[]>` will store individual boards on the server. Next.js dynamic routing (`app/[roomId]/page.tsx`) will be used so users can share boards by sending a URL link.
3.  **Optimistic UI Sync**: To prevent drawing lag, shapes render locally *immediately* (as they do now). When the pointer is released, the client emits an `element-update` event with the newly drawn shape. The server broadcasts it to all peers, who push it to their Zustand `elements` array. Because every shape has a unique `id`, there are no array-index conflicts.
4.  **Live Cursors**: Clients will emit throttled `cursor-move` events. Other clients will render these strictly as floating SVG/HTML nodes over the canvas using CSS `transform` and `transition: all 0.1s linear` for buttery smooth cursors without clogging the Canvas render loop.
