# Persona UI

Part of **Persona**, a memory system for AI characters. This repository is the web front end: a Next.js app for chatting with a persona, returning to earlier sessions, managing personas and their source documents, and reading the evidence behind each reply. The other two parts:

- [persona-chatbot](https://github.com/tinasheosewe/persona-chatbot): the FastAPI chat backend this UI talks to (per-character RAG, hierarchical memory, agentic retrieval).
- [persona-memory-graph](https://github.com/tinasheosewe/persona-memory-graph): the knowledge-graph pipeline and query API the backend can call for graph facts.

## Built on assistant-ui

The chat interface is built on [assistant-ui](https://github.com/assistant-ui/assistant-ui) (MIT, AgentbaseAI Inc.). This repository started as a copy of the assistant-ui repository, so its history begins with assistant-ui's commits; this project's commits start in November 2025. The app grew out of upstream's `with-external-store` example and was then reduced to a single Next.js project.

- From assistant-ui: the `@assistant-ui/react` and `@assistant-ui/react-markdown` packages; the unmodified example files `components/assistant-ui/markdown-text.tsx`, `components/assistant-ui/tooltip-icon-button.tsx`, `components/ui/button.tsx`, `components/ui/tooltip.tsx` and `lib/utils.ts`; and the starting points for `components/assistant-ui/thread.tsx`, `app/MyRuntimeProvider.tsx`, `app/layout.tsx`, `app/page.tsx` and `app/globals.css`.
- Added here: the runtime provider that connects assistant-ui's external-store runtime to the FastAPI backend (persona selection, session history, streaming over server-sent events, cancel and retry, per-message references), the session sidebar, the references panel, the persona studio (create, rename and delete personas; upload, view and delete their documents), the document preview route, backend URL resolution and the Docker build.

`LICENSE` is the upstream MIT license and applies to this repository.

## Chatbot UI

A minimal Next.js 16 front-end that talks to a FastAPI chatbot backend. The UI keeps a list of previous sessions, lets you select a character persona, and streams assistant responses over `text/event-stream`.

## Requirements

- Node.js 20.9+
- `pnpm` 9.12.3 (matches the pinned version in `package.json`)
- A running [persona-chatbot](https://github.com/tinasheosewe/persona-chatbot) backend that exposes `/characters`, `/chat/stream`, and `/logs` (defaults to `http://localhost:8000`).

If you're not running the backend on the same host, create a `.env.local` to point at it (`.env.example` shows the variable):

```bash
NEXT_PUBLIC_FASTAPI_URL=https://your-fastapi.example.com
```

## Install & run

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Pick a character, start messaging, and use the left sidebar to jump back into saved sessions or start a fresh chat. Sessions are read from the backend's `/logs` endpoint, which keeps them in memory, so they are gone after a backend restart.

### Character management page

Need to inspect or update a character's knowledge base without leaving the browser?
Navigate to `/characters`, or click the settings button (cog icon) on the chat page, which
opens the same manager in a dialog. It loads the character list from the backend and lets you:

- Create, rename and delete personas.
- View every document currently attached to a character, with its path and size.
- Open a document. In the settings dialog, PDF, text, Markdown and HTML files are shown in the
	built-in viewer and other types are downloaded; on the `/characters` page the backend's download link opens in a new tab.
- Upload new source files. The backend rebuilds the character's vectors in the background
	after each upload, and the upload status panel tracks each file.
- Remove outdated documents, which automatically triggers a vector rebuild so the
	embeddings stay in sync.

All actions talk to the `/characters` and `/characters/{character}/documents` endpoints of the
FastAPI server, so no extra configuration is required beyond running both apps.

The document viewer loads files through `app/api/document-preview`, a server route that fetches the
document from the backend and serves it inline. It only fetches URLs on the configured backend host
or on the app's own host.

## Production build

```bash
pnpm build
pnpm start
```

The included `Dockerfile` performs the same steps in a multi-stage container build so you can deploy anywhere that runs containers.

## Deployment notes

- The Dockerfile explicitly installs `pnpm@9.12.3` because Corepack inside Node 20.18.1 ships without the signing key that pnpm now uses. Without that pin you'll see `Cannot find matching keyid` errors during `pnpm install` on Render or other CI environments.
- If you're building outside of Docker, either run `corepack prepare pnpm@9.12.3 --activate` or prefix commands with `npx pnpm@9.12.3` so your local environment matches.
- Render builds the Dockerfile directly, so no extra service configuration is required.
- The Docker image bakes in `NEXT_PUBLIC_FASTAPI_URL=https://your-backend.example.com`, a placeholder. Set your backend URL in the `Dockerfile` (both stages) before building so the client bundle picks it up.
- The UI has no authentication of its own, and neither does the backend.

## Linting

```bash
pnpm lint
```

Linting uses the `eslint-config-next` flat config (see `eslint.config.mjs`). There is no automated test suite; `pnpm lint` and `pnpm build` are the available checks.

The GitHub Actions workflow in `.github/workflows/ci.yml` runs both on Node.js 20 on every push to `main` and on pull requests: `pnpm install --frozen-lockfile`, `pnpm lint`, then `pnpm build`.

## Project structure

```
app/                       # App Router: layout, chat page, /characters page, runtime provider
app/api/document-preview/  # Server route that proxies backend documents for inline viewing
components/assistant-ui/   # Thread, session sidebar, references panel, markdown rendering
components/persona-studio/ # Persona and document manager
components/ui/             # Button and tooltip primitives
lib/                       # Backend URL resolution, className merger
next.config.ts             # Minimal Next.js configuration
postcss.config.mjs         # TailwindCSS 4 pipeline configuration
```

## Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_FASTAPI_URL` | Base URL for the FastAPI backend | Auto-detects (same origin when not on `localhost`, otherwise `http://localhost:8000`) |

When this variable is omitted, the UI prefers the page's current origin whenever it's not being served from `localhost`, which prevents "local network access" browser prompts and the CORS errors that appear after denying them. On localhost, it still falls back to `http://localhost:8000` for a smooth dev-loop. Missing or incorrect URLs will cause character loading to fail, so make sure your backend is reachable before starting the UI.
