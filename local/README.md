# blame

CLI that clones a GitHub repo's history and prints a table of every contributor's
name, email, GitHub username (when derivable), and commit count.

## Install

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e .
```

## Usage

```powershell
blame owner/repo
blame https://github.com/owner/repo
blame github.com/owner/repo
blame owner/repo --merges           # include merge commits
blame owner/repo --sort-by name     # commits (default) / name / recent
blame owner/repo --limit 10         # top 10 by commit count
blame owner/repo --has-email        # only contributors with a real, public email
blame owner/repo -o contributors.csv
blame owner/repo -o contributors.json
blame --version
```

## Notes

- `noreply.github.com` addresses (GitHub's "keep my email private" alias) are
  never shown as an email — they're not reachable, so the field is left blank
  and the GitHub username (derived from the same address) is shown instead.
  Use `--has-email` to drop those contributors from the results entirely.
- Contributors are grouped by email address. The same person committing
  under two different emails will show up as two rows.
