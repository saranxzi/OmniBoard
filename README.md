# 🎨 OmniBoard

A **real-time collaborative whiteboard** built for seamless team collaboration — draw, sketch, annotate, and brainstorm together with live cursors and instant sync.

> _"Miro meets Discord"_ — A portfolio-grade collaborative workspace.

## ✨ Features

- **11 Drawing Tools** — Select, Pencil (freehand), Line, Arrow, Rectangle, Ellipse, Diamond, **Star**, **Sticky Note**, Text, Eraser
- **Real-Time Collaboration** — Live cursor tracking, instant element sync via WebSocket
- **Live Text Chat** — Premium sliding chat panel with unread message badges and real-time broadcasting
- **Unified Toolbar** — All tools, colors, stroke widths, undo/redo, zoom, export, and clear action in one clean "glassmorphism" bar
- **Workspace Settings** — Room codes, privacy controls (Public/Private), and real-time creator-led user kicking
- **Infinite Canvas** — Smooth pan & zoom with pinch/scroll support and a subtle dotted grid
- **Sketchy Aesthetic** — Rough.js hand-drawn style rendering for that "whiteboard" feel
- **Secure Auth** — Multi-layered registration & login with bcrypt, per-IP rate limiting, and backend hardening
- **Export** — Download your creative masterpieces as high-quality PNGs
- **Keyboard Shortcuts** — V, P, L, A, R, O, D, S, N, T, E for tools; Ctrl+Z/Y for undo/redo; Delete to remove element

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
| Styling | Tailwind CSS + Framer Motion |
| State | Zustand |
| Canvas | HTML5 Canvas + Rough.js |
| Real-time | Socket.IO |
| Database | Neon PostgreSQL (Cloud) |
| ORM | Prisma |
| Auth | bcryptjs + timing-safe-equal |
| Icons | Lucide React |

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18
- pnpm (or npm/yarn)

### Installation

1. **Clone and Install Backend/Frontend Dependencies:**
   ```bash
   pnpm install
   ```

2. **Database Sync (Neon Postgres):**
   Make sure your `.env` is configured (I have already done this for you!).
   ```bash
   npx prisma db push
   ```

### 🏃‍♂️ Running the Project

You need to run **two separate terminals** for the full experience:

#### Terminal 1: Next.js Frontend
```bash
pnpm dev
```

#### Terminal 2: WebSocket Server (Backend)
```bash
node server/index.js
```

Once both are running:
1. Open [http://localhost:3000](http://localhost:3000).
2. Register an account and Create/Join a room!
3. Invite a friend (or open another tab) to see real-time sync in action!

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
