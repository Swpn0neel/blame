import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Restricted GitHub API proxy used only as a fallback for the interactive
 * scan when the visitor hasn't supplied their own token — see the root
 * README's "Server-side token fallback" section for the tradeoffs. Never
 * used when a visitor's own token is present; that path stays fully
 * client-side and talks to api.github.com directly. */

const OWNER_REPO_RE = /^[\w.-]+$/;
const RESOURCES = new Set(["repo", "commits"]);
const FORWARDED_RESPONSE_HEADERS = ["x-ratelimit-remaining", "retry-after", "link"];

export async function GET(request: NextRequest) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "no_server_token" }, { status: 501 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner") ?? "";
  const repo = searchParams.get("repo") ?? "";
  const resource = searchParams.get("resource") ?? "";

  if (!OWNER_REPO_RE.test(owner) || !OWNER_REPO_RE.test(repo) || !RESOURCES.has(resource)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let upstreamUrl = `https://api.github.com/repos/${owner}/${repo}`;
  if (resource === "commits") {
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "100", 10) || 100));
    upstreamUrl += `/commits?per_page=${perPage}&page=${page}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }

  const body = await upstream.text();
  const headers = new Headers({
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
  });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new NextResponse(body, { status: upstream.status, headers });
}
