from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

GIT_LOG_SEP = "\x1f"  # unit separator, unlikely to appear in author data
NOREPLY_RE = re.compile(
    r"^(?:\d+\+)?(?P<username>[^@]+)@users\.noreply\.github\.com$", re.IGNORECASE
)


class BlameError(Exception):
    pass


@dataclass
class Contributor:
    name: str
    email: str
    username: str = ""
    commits: int = 0
    first_commit: str = ""
    last_commit: str = ""


def normalize_repo_url(repo: str) -> str:
    """Accept full URLs, owner/repo shorthand, or .git URLs and return a cloneable URL."""
    repo = repo.strip()
    if repo.startswith("git@") or repo.endswith(".git"):
        return repo
    if repo.startswith("http://") or repo.startswith("https://"):
        return repo
    # owner/repo shorthand
    if re.match(r"^[\w.-]+/[\w.-]+$", repo):
        return f"https://github.com/{repo}.git"
    raise BlameError(f"Could not understand repo reference: {repo!r}")


def repo_display_name(repo_url: str) -> str:
    parsed = urlparse(repo_url if "://" in repo_url else f"https://{repo_url}")
    path = parsed.path or repo_url
    return path.strip("/").removesuffix(".git")


def clone_bare(repo_url: str, dest: Path) -> None:
    cmd = ["git", "clone", "--bare", "--quiet", repo_url, str(dest)]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        raise BlameError(
            f"git clone failed for {repo_url!r}:\n{proc.stderr.strip()}"
        )


def extract_username_from_email(email: str) -> str:
    m = NOREPLY_RE.match(email)
    return m.group("username") if m else ""


def parse_git_log(repo_dir: Path, include_merges: bool = False) -> list[Contributor]:
    fmt = GIT_LOG_SEP.join(["%H", "%an", "%ae", "%ad"])
    cmd = [
        "git",
        "-C",
        str(repo_dir),
        "log",
        "--all",
        f"--pretty=format:{fmt}",
        "--date=short",
    ]
    if not include_merges:
        cmd.insert(cmd.index("--all") + 1, "--no-merges")
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        raise BlameError(f"git log failed:\n{proc.stderr.strip()}")

    by_email: dict[str, Contributor] = {}
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split(GIT_LOG_SEP)
        if len(parts) != 4:
            continue
        _sha, name, email, date = parts
        key = email.lower()
        c = by_email.get(key)
        if c is None:
            is_private = bool(NOREPLY_RE.match(email))
            c = Contributor(
                name=name,
                email="" if is_private else email,
                username=extract_username_from_email(email),
                first_commit=date,
                last_commit=date,
            )
            by_email[key] = c
        c.commits += 1
        # git log is newest-first; track the earliest/latest dates seen
        if date < c.first_commit:
            c.first_commit = date
        if date > c.last_commit:
            c.last_commit = date
        # prefer the most recently used name spelling (first one seen, since newest-first)
    return sorted(by_email.values(), key=lambda c: c.commits, reverse=True)


def gather_contributors(repo: str, include_merges: bool = False) -> tuple[str, list[Contributor]]:
    repo_url = normalize_repo_url(repo)
    name = repo_display_name(repo_url)
    tmp_dir = Path(tempfile.mkdtemp(prefix="blame-"))
    try:
        clone_bare(repo_url, tmp_dir)
        contributors = parse_git_log(tmp_dir, include_merges=include_merges)
        return name, contributors
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
