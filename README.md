# Chatbot UI

A minimal Next.js 16 front-end that talks to a FastAPI chatbot backend. The UI keeps a list of previous sessions, lets you select a character persona, and streams assistant responses over `text/event-stream`.

## Requirements

- Node.js 20+
- `pnpm` 10.22+ (Corepack works great)
- A running FastAPI backend that exposes `/characters`, `/chat/stream`, and `/logs` (defaults to `http://localhost:8000`).

Create a `.env.local` to point at your backend:

```bash
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
```

## Install & run

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Pick a character, start messaging, and use the left sidebar to jump back into saved sessions or start a fresh chat.

## Production build

```bash
pnpm build
pnpm start
```

The included `Dockerfile` performs the same steps in a multi-stage container build so you can deploy anywhere that runs containers.

## Linting

```bash
pnpm lint
```

Linting relies on Next.js’ built-in ESLint preset (`next/core-web-vitals`).

## Project structure

```
app/                 # App Router files, layouts, and providers
components/          # UI pieces (thread, sidebar, buttons, tooltips, etc.)
lib/                 # Shared helpers (e.g., className merger)
next.config.ts       # Minimal Next.js configuration
postcss.config.mjs   # TailwindCSS 4 pipeline configuration
```

## Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_FASTAPI_URL` | Base URL for the FastAPI backend | `http://localhost:8000` |

Missing or incorrect URLs will cause character loading to fail, so make sure your backend is reachable before starting the UI.
