# blame — web app

Single-page Next.js app: paste a GitHub repo, configure the scan, watch it run, get a contributor table. Reads data straight from `api.github.com` in the browser — no server, no API routes, nothing stored.

See the [root README](../README.md) for the full picture (this app alongside the `local/` CLI) and usage instructions.

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind CSS v4
- No backend — GitHub REST API calls happen client-side; an optional personal access token is sent directly from the browser to `api.github.com` and never touches a server

## Structure

- `src/lib/github.ts` — GitHub API client, contributor aggregation, CSV/markdown export
- `src/lib/fuzzy.ts` — DP-based fuzzy matcher powering the results table's search
- `src/components/` — `ScanForm`, `ScanLog`, `ResultsTable`, `Background`, `BlameApp` (orchestrator)
- `PRODUCT.md` / `DESIGN.md` at the repo root document the product intent and visual design system

## Deploy

Zero-config Next.js deploy (Vercel or any Next.js host):

```bash
npx vercel deploy
```
