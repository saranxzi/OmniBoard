# 🎨 OmniBoard

A **real-time collaborative whiteboard** built for seamless team collaboration — draw, sketch, annotate, and brainstorm together with live cursors and instant sync.

> _"Miro meets Discord"_ — A portfolio-grade collaborative workspace.

## ✨ Features

- **9 Drawing Tools** — Select, Pencil (freehand), Line, Arrow, Rectangle, Ellipse, Diamond, Text, Eraser
- **Real-Time Collaboration** — Live cursor tracking, instant element sync via WebSocket
- **Unified Toolbar** — All tools, colors, stroke widths, undo/redo, zoom, export in one clean bar
- **Workspace Settings** — Room codes, privacy controls, active user list
- **Responsive Canvas** — Infinite pan & zoom with pinch/scroll support
- **Sketchy Aesthetic** — Rough.js hand-drawn style rendering
- **Auth System** — Secure registration & login with bcrypt, rate limiting, and timing-attack prevention
- **Export** — Download your board as a PNG image
- **Keyboard Shortcuts** — V, P, L, A, R, O, D, T, E for tools; Ctrl+Z/Y for undo/redo; Delete to remove

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js Frontend                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Board.tsx │  │Toolbar   │  │ WorkspaceSettings │  │
│  │ (canvas) │  │(unified) │  │   (room mgmt)     │  │
│  └────┬─────┘  └──────────┘  └───────────────────┘  │
│       │                                              │
│  ┌────┴──────────────────────────────────────────┐   │
│  │ Hooks: useSocketSync, useCanvasRenderer,      │   │
│  │        useDrawingHandlers, useKeyboardShortcuts│   │
│  └────┬──────────────────────────────────────────┘   │
│       │              │                               │
│  ┌────┴────┐   ┌─────┴─────┐                        │
│  │ Zustand │   │ API Routes│                         │
│  │  Store  │   │ (auth,    │                         │
│  └─────────┘   │  rooms)   │                         │
│                └─────┬─────┘                         │
└──────────────────────┼───────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
   ┌──────┴──────┐ ┌──┴──┐ ┌──────┴──────┐
   │ Socket.IO   │ │SQLite│ │   Prisma    │
   │  Server     │ │ (DB) │ │   ORM       │
   │ (port 3001) │ └─────┘ └─────────────┘
   └─────────────┘
```

## 🛠 Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Canvas | HTML5 Canvas + Rough.js |
| Freehand | perfect-freehand |
| Animations | Framer Motion |
| Real-time | Socket.IO |
| Database | SQLite via Prisma |
| Auth | bcryptjs |
| Icons | Lucide React |

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- pnpm (or npm/yarn)

### Installation

```bash
git clone https://github.com/saranxzi/OmniBoard.git
cd OmniBoard/v1
pnpm install
cd server && pnpm install && cd ..
```

### Database Setup

```bash
npx prisma db push
```

### Run Development

```bash
# Terminal 1 — Next.js frontend
pnpm dev

# Terminal 2 — WebSocket server
node server/index.js
```

Open [http://localhost:3000](http://localhost:3000) to start collaborating.

## 📡 API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Authenticate user |
| POST | `/api/rooms/create` | Create a new room |
| POST | `/api/rooms/verify` | Verify room code |

### Error Response Format

All API errors return a structured envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "details": [
      { "field": "password", "reason": "Must be at least 8 characters." }
    ]
  }
}
```

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| V | Select tool |
| P | Pencil |
| L | Line |
| A | Arrow |
| R | Rectangle |
| O | Ellipse |
| D | Diamond |
| T | Text |
| E | Eraser |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Delete / Backspace | Delete selected |
| Escape | Deselect |

## 📁 Project Structure

```
src/
├── app/              # Next.js pages & API routes
│   ├── api/auth/     # Login & register endpoints
│   ├── api/rooms/    # Room management endpoints
│   ├── board/        # Collaborative board page
│   ├── login/        # Login page
│   └── register/     # Registration page
├── components/       # React components
│   ├── Board.tsx     # Canvas shell (95 lines)
│   ├── Toolbar.tsx   # Unified toolbar
│   └── WorkspaceSettings.tsx
├── hooks/            # Extracted custom hooks
│   ├── useCanvasRenderer.ts
│   ├── useDrawingHandlers.ts
│   ├── useKeyboardShortcuts.ts
│   └── useSocketSync.ts
├── store/            # Zustand state stores
├── utils/            # Board utility functions
└── lib/              # Prisma client, socket config
server/
└── index.js          # Socket.IO WebSocket server
```

## 🔒 Security

- Passwords hashed with bcrypt (12 salt rounds)
- Rate limiting on auth endpoints (5 register/min, 10 login/min per IP)
- Timing-attack prevention on login (constant-time response)
- WebSocket event rate limiting (120 events/sec per socket)
- Input validation and sanitization on all endpoints
- Payload size limits on WebSocket messages (1MB max)
- Generic error messages to prevent email enumeration

## 📄 License

MIT
