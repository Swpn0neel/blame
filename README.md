# blame

Answers one question for a GitHub repository: "who actually contributed, and how much?" Comes in two forms: a local CLI and a web app, both under the same name, `blame`. This project is mainly built to extract the mail id of contributors for recruitment/business purpose, but can be used for any purpose.

| | [`local/`](local) | [`web/`](web) |
|---|---|---|
| Form | Python CLI | Next.js single-page app |
| Data source | Clones the repo and reads `git log` directly | Calls the GitHub REST API from your browser |
| Coverage | Full history, every branch (`--all`) | Commits reachable from the default branch |
| Output | Terminal table, CSV, or JSON file | On-page table, copy as markdown, or download CSV |
| Best for | Scripting, CI, full-repo audits, working offline once cloned | Quick one-off lookups, sharing a link, no install |

Both report the same core fields: name, email, GitHub username (when derivable), and commit count per contributor.

## `local/` — the CLI

Clones the target repo to a temp directory, runs `git log`, and aggregates commits by author email.

### Install

```powershell
cd local
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
```

### Use

```powershell
blame owner/repo
blame https://github.com/owner/repo
blame github.com/owner/repo
blame owner/repo --merges           # include merge commits (excluded by default)
blame owner/repo --sort-by name     # commits (default) / name / recent
blame owner/repo --limit 10         # top 10 contributors
blame owner/repo --has-email        # only contributors with a real, public email
blame owner/repo -o contributors.csv
blame owner/repo -o contributors.json
```

Requires `git` on your `PATH`. Notes:

- GitHub usernames are only filled in when the commit email is a `*@users.noreply.github.com` address — git itself has no concept of a GitHub username, so anything beyond that would require per-commit GitHub API calls.
- Contributors are grouped purely by email address. The same person committing under two different emails shows up as two rows — there's no account-linking concept at the git level to merge them.

## `web/` — the app

A single page: paste a repo, configure the scan, watch it run, get a table. Reads data straight from `api.github.com` in your browser — nothing is sent to or stored on a server.

### Run it locally

```powershell
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Use

1. Paste a repo as `owner/repo` or a full `github.com/owner/repo` URL.
2. Optionally expand **Add a token** and paste a GitHub personal access token, then click **Apply** — this raises the unauthenticated rate limit (60 requests/hour) and is required for private repos. The token is sent directly to `api.github.com` from your browser and never stored.
3. Adjust the scan options: include/exclude merge commits, sort order, limit to the top N contributors, and which columns to show.
4. Click **Run scan** and watch the progress log (resolving repo → fetching commits → aggregating authors → done).
5. From the results table, **Copy as markdown** or **Download CSV**.

### Deploy

It's a standard Next.js app with no server-side secrets or API routes — deploys to Vercel (or any Next.js host) with zero configuration:

```powershell
cd web
npx vercel deploy
```

### Notes

- Because it uses the GitHub API's commits endpoint rather than `git log --all`, it only sees history reachable from the repo's default branch — contributor counts can differ slightly from the CLI's full-history view.
- Contributors are grouped by GitHub account when a commit is linked to one, falling back to email otherwise. This means the **same person can still appear as two rows** if some of their commits were made before they linked their GitHub account (or with an email GitHub can't match) and others after — GitHub's API, not this tool, decides that linkage. Worth a manual sanity-check before treating a "top contributor" ranking as authoritative, especially for recruitment/outreach use.
- `PRODUCT.md` and `DESIGN.md` at the repo root document the product intent and visual design system behind the web app, for anyone extending it.
