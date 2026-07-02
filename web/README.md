# blame — web app

Single-page Next.js app: paste a GitHub repo, configure the scan, watch it run, get a contributor table. The interactive scan is fully client-side — reads straight from `api.github.com` in the browser, nothing stored. One optional feature (the embeddable contributor-card image) runs server-side; see below.

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
- Interactive scan flow is client-driven — with a personal access token, calls go directly from the browser to `api.github.com` and the token never touches this app's server. Without one, the browser tries a same-origin proxy (`/api/github`) first, which can use a server-configured `GITHUB_TOKEN` to raise the shared rate limit, falling back to a direct unauthenticated call if no server token is set — see the root README's "Server-side token fallback" section
- Two server-side routes: `/api/card/[owner]/[repo]` renders an embeddable PNG contributor card via `next/og`, and `/api/github` is the restricted proxy above. Both optionally read a `GITHUB_TOKEN` env var (server-side only) — see the root README

## Structure

- `src/lib/github.ts` — GitHub API client, contributor aggregation, CSV/markdown export
- `src/lib/fuzzy.ts` — DP-based fuzzy matcher powering the results table's search
- `src/components/` — `ScanForm`, `ScanLog`, `ResultsTable`, `Background`, `BlameApp` (orchestrator)
- `src/app/api/card/[owner]/[repo]/route.tsx` — embeddable contributor-card image endpoint
- `src/app/api/github/route.ts` — restricted GitHub API proxy, used as a fallback for token-less interactive scans
- `src/assets/card/` — bundled Silkscreen/Space Grotesk font files used only by the card route (read via `fs`, not served publicly); static instances specifically, since `next/og`'s renderer can't parse variable-weight TTFs
- `PRODUCT.md` / `DESIGN.md` at the repo root document the product intent and visual design system

## Deploy

Zero-config Next.js deploy (Vercel or any Next.js host):

```bash
npx vercel deploy
```

Optionally set `GITHUB_TOKEN` in your deployment's environment variables if you expect the embed feature to see real traffic (see root README).
