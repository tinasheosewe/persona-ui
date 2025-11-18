# Chatbot UI

A minimal Next.js 16 front-end that talks to a FastAPI chatbot backend. The UI keeps a list of previous sessions, lets you select a character persona, and streams assistant responses over `text/event-stream`.

## Requirements

- Node.js 20+
- `pnpm` 9.12.3 (matches the pinned version in `package.json`)
- A running FastAPI backend that exposes `/characters`, `/chat/stream`, and `/logs` (defaults to `http://localhost:8000`).

If you're not running the backend on the same host, create a `.env.local` to point at it:

```bash
NEXT_PUBLIC_FASTAPI_URL=https://your-fastapi.example.com
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

## Deployment notes

- The Dockerfile explicitly installs `pnpm@9.12.3` because Corepack inside Node 20.18.1 ships without the signing key that pnpm now uses. Without that pin you'll see `Cannot find matching keyid` errors during `pnpm install` on Render or other CI environments.
- If you're building outside of Docker, either run `corepack prepare pnpm@9.12.3 --activate` or prefix commands with `npx pnpm@9.12.3` so your local environment matches.
- Render automatically consumes the Dockerfile, so redeploying after this change is enough—no extra service configuration is required.
- The Docker image now bakes in `NEXT_PUBLIC_FASTAPI_URL=https://your-backend.example.com`. Update the `Dockerfile` if you deploy a different backend URL, then rebuild/push so the client bundle picks it up.

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
| `NEXT_PUBLIC_FASTAPI_URL` | Base URL for the FastAPI backend | Auto-detects (same origin when not on `localhost`, otherwise `http://localhost:8000`) |

When this variable is omitted, the UI now prefers the page's current origin whenever it's not being served from `localhost`, which prevents "local network access" browser prompts and the CORS errors that appear after denying them. On localhost, it still falls back to `http://localhost:8000` for a smooth dev-loop. Missing or incorrect URLs will cause character loading to fail, so make sure your backend is reachable before starting the UI.
