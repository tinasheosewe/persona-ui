# with-external-store + FastAPI backend

This example wires the `assistant-ui` external store runtime to a FastAPI chatbot backend that exposes a `POST /chat` endpoint. The UI stores the server-issued `session_id`, forwards user text to FastAPI, and renders the assistant response once it comes back.

## Prerequisites

- FastAPI server running locally (default: `http://localhost:8000`)
- Node.js 20+
- `pnpm` 10.22 (commands below use `npx pnpm@10.22.0` so a global install is optional)

Set the backend URL via `.env.local`:

```
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
```

## Install & build workspace packages

From the repo root (`CHATBOT-UI/`):

```bash
npx pnpm@10.22.0 install
npx pnpm@10.22.0 --filter assistant-stream run build
npx pnpm@10.22.0 --filter assistant-cloud run build
```

The `assistant-stream` build is required because `assistant-cloud` depends on its generated `dist/` files, and the example consumes both packages directly from the workspace.

## Run the example locally

```bash
npx pnpm@10.22.0 --filter with-external-store run dev
```

Then open <http://localhost:3000>. Messages you send in the UI will be forwarded to FastAPI, which should respond with JSON shaped like:

```json
{
  "session_id": "abc123",
  "response": "Hello from FastAPI!"
}
```

## Production build check

```bash
npx pnpm@10.22.0 --filter with-external-store run build
```

## Linting

Next.js v16 no longer exposes a `next lint` command, so lint directly via ESLint:

```bash
cd examples/with-external-store
npx pnpm@10.22.0 exec eslint --max-warnings=0 .
```

(You may see "Pages directory cannot be found" logged once because this project only uses the App Router; the run still exits with code 0.)

## Deploying to Render

This repository now ships with a production-ready Docker image and a `render.yaml` blueprint so you can deploy the example UI in a single Render **Web Service**.

1. Push your fork of `CHATBOT-UI` to GitHub.
2. In Render, create a new **Blueprint** from the repo root. The included `render.yaml` provisions a service named `chatbot-ui-external-store` that builds and runs the example via Docker.
3. When prompted, set `NEXT_PUBLIC_FASTAPI_URL` to the public URL of your FastAPI backend (for the shared backend we use `https://your-backend.example.com`).
4. Render builds the Docker image by executing the workspace installs/builds, then runs `pnpm --filter with-external-store run start -- --hostname 0.0.0.0 --port $PORT`, which binds to Render's dynamic port automatically.

### Custom tweaks

- **Different backend URL?** Update `render.yaml` or override the environment variable in the Render dashboard.
- **Need extra packages?** Modify the root `Dockerfile` to add any system dependencies or additional `pnpm --filter` builds.
- **Multiple environments?** Duplicate the service block inside `render.yaml` with different names/env vars.
