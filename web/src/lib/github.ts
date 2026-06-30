export type Contributor = {
  key: string;
  name: string;
  username: string | null;
  email: string;
  avatarUrl: string | null;
  commits: number;
  firstCommit: string;
  lastCommit: string;
};

export type SortBy = "commits" | "name" | "recent";

const NOREPLY_EMAIL_RE = /@users\.noreply\.github\.com$/i;

export function isPrivateEmail(email: string): boolean {
  return NOREPLY_EMAIL_RE.test(email);
}

export class GithubApiError extends Error {
  status: number;
  rateLimited: boolean;

  constructor(message: string, status: number, rateLimited: boolean) {
    super(message);
    this.name = "GithubApiError";
    this.status = status;
    this.rateLimited = rateLimited;
  }
}

export function parseRepoInput(raw: string): { owner: string; repo: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Enter a repository URL or owner/repo.");
  }

  const shorthand = trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (shorthand && !trimmed.includes("://") && !trimmed.startsWith("github.com")) {
    return { owner: shorthand[1], repo: shorthand[2] };
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("That doesn't look like a valid repository URL.");
  }

  if (!/(^|\.)github\.com$/.test(url.hostname)) {
    throw new Error("Only github.com repositories are supported right now.");
  }

  const parts = url.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("That URL doesn't point at a specific repository.");
  }

  return { owner: parts[0], repo: parts[1] };
}

async function ghFetch(url: string, token: string | null): Promise<Response> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const rateLimited =
      (res.status === 403 || res.status === 429) &&
      res.headers.get("x-ratelimit-remaining") === "0";

    const message = rateLimited
      ? "Hit GitHub's API rate limit. Add a personal access token below to keep going."
      : res.status === 404
        ? "Repository not found — check the URL, or add a token if it's private."
        : res.status === 403
          ? "GitHub API access denied for this repository."
          : `GitHub API error (${res.status}).`;

    throw new GithubApiError(message, res.status, rateLimited);
  }

  return res;
}

export async function verifyRepoExists(
  owner: string,
  repo: string,
  token: string | null,
): Promise<void> {
  await ghFetch(`https://api.github.com/repos/${owner}/${repo}`, token);
}

type RawCommit = {
  sha: string;
  commit: {
    author: { name: string; email: string; date: string } | null;
  };
  author: { login: string; id: number; avatar_url: string } | null;
  parents: { sha: string }[];
};

const MAX_PAGES = 100;
const PER_PAGE = 100;

function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="next"'));
  if (!match) return null;
  const urlMatch = match.match(/<([^>]+)>/);
  return urlMatch ? urlMatch[1] : null;
}

export async function fetchAllCommits(
  owner: string,
  repo: string,
  token: string | null,
  onProgress: (commitsScanned: number, truncated: boolean) => void,
): Promise<RawCommit[]> {
  const commits: RawCommit[] = [];
  let url: string | null = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${PER_PAGE}`;
  let page = 0;

  while (url && page < MAX_PAGES) {
    const res = await ghFetch(url, token);
    const batch = (await res.json()) as RawCommit[];
    commits.push(...batch);
    page += 1;
    url = parseNextLink(res.headers.get("link"));
    onProgress(commits.length, Boolean(url) && page >= MAX_PAGES);
    if (batch.length < PER_PAGE) break;
  }

  return commits;
}

export function aggregateContributors(
  commits: RawCommit[],
  includeMerges: boolean,
): Contributor[] {
  const byKey = new Map<string, Contributor>();

  for (const commit of commits) {
    if (!includeMerges && commit.parents.length > 1) continue;
    if (!commit.commit.author) continue;

    const { name, email, date } = commit.commit.author;
    const key = commit.author ? `id:${commit.author.id}` : `email:${email.toLowerCase()}`;

    const existing = byKey.get(key);
    if (existing) {
      existing.commits += 1;
      if (date < existing.firstCommit) existing.firstCommit = date;
      if (date > existing.lastCommit) existing.lastCommit = date;
    } else {
      byKey.set(key, {
        key,
        name,
        username: commit.author?.login ?? null,
        email: isPrivateEmail(email) ? "" : email,
        avatarUrl: commit.author?.avatar_url ?? null,
        commits: 1,
        firstCommit: date,
        lastCommit: date,
      });
    }
  }

  return Array.from(byKey.values());
}

export function filterHasEmail(list: Contributor[]): Contributor[] {
  return list.filter((c) => c.email);
}

export function sortContributors(list: Contributor[], sortBy: SortBy): Contributor[] {
  const sorted = [...list];
  switch (sortBy) {
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "recent":
      sorted.sort((a, b) => (a.lastCommit < b.lastCommit ? 1 : -1));
      break;
    case "commits":
    default:
      sorted.sort((a, b) => b.commits - a.commits);
      break;
  }
  return sorted;
}

export type ColumnKey = "username" | "email" | "firstCommit" | "lastCommit";

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  username: "Username",
  email: "Email",
  firstCommit: "First commit",
  lastCommit: "Last commit",
};

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function toMarkdownTable(
  list: Contributor[],
  columns: Record<ColumnKey, boolean>,
): string {
  const headers = ["Name"];
  if (columns.username) headers.push("Username");
  if (columns.email) headers.push("Email");
  headers.push("Commits");
  if (columns.firstCommit) headers.push("First commit");
  if (columns.lastCommit) headers.push("Last commit");

  const rows = list.map((c) => {
    const cells = [c.name];
    if (columns.username) cells.push(c.username ? `@${c.username}` : "");
    if (columns.email) cells.push(c.email);
    cells.push(String(c.commits));
    if (columns.firstCommit) cells.push(formatDate(c.firstCommit));
    if (columns.lastCommit) cells.push(formatDate(c.lastCommit));
    return cells;
  });

  const escape = (s: string) => s.replace(/\|/g, "\\|");
  const headerLine = `| ${headers.map(escape).join(" | ")} |`;
  const dividerLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = rows.map((cells) => `| ${cells.map(escape).join(" | ")} |`);

  return [headerLine, dividerLine, ...bodyLines].join("\n");
}

export function toCsv(list: Contributor[], columns: Record<ColumnKey, boolean>): string {
  const headers = ["name"];
  if (columns.username) headers.push("username");
  if (columns.email) headers.push("email");
  headers.push("commits");
  if (columns.firstCommit) headers.push("first_commit");
  if (columns.lastCommit) headers.push("last_commit");

  const escape = (s: string) => {
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const rows = list.map((c) => {
    const cells = [c.name];
    if (columns.username) cells.push(c.username ?? "");
    if (columns.email) cells.push(c.email);
    cells.push(String(c.commits));
    if (columns.firstCommit) cells.push(formatDate(c.firstCommit));
    if (columns.lastCommit) cells.push(formatDate(c.lastCommit));
    return cells.map(escape).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
