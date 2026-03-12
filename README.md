# OmniBoard

OmniBoard is a Real-Time Collaborative Workspace, inspired by principles from collaborative tools like Miro and Discord. It is being built in phases to support local drawing, real-time multiplayer sync, and an embedded video communication layer.

## 🚀 Current Features (Phase 1 & Auth)

- **Infinite Canvas & Drawing**: Built with HTML5 Canvas and Rough.js for a hand-drawn aesthetic.
- **Pan & Zoom**: Infinite panning and zooming capabilities.
- **Tools**: Selection, Rectangle, Diamond, Ellipse, Arrow, Line, Freehand sketching, and Text insertion.
- **Element Resizing**: Core board component refactored to support drag-handle resizing of selected elements.
- **Authentication**: Temporary robust backend auth for login/registration to personalize the workspace lobby.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Directory)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Graphics**: HTML5 Canvas & [Rough.js](https://roughjs.com/)

## 🗺️ Roadmap

- **Phase 1 (Current)**: Local engine, core tools, infinite canvas, and initial temporary authentication.
- **Phase 2 (Upcoming)**: Multiplayer Sync combining Node.js, Express, and Socket.io for live cursors and real-time element synchronization.
- **Phase 3 (Upcoming)**: Video Layer integration utilizing LiveKit WebRTC for embedded live video bubbles alongside the canvas.
- **Security**: Upgrading temporary auth to a robust standard (e.g., NextAuth/Auth.js).

## 💻 Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the outcome.
