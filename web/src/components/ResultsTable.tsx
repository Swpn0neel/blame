"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  BLAME_SITE_URL,
  type ColumnKey,
  type Contributor,
  type ContributorMatch,
  downloadFile,
  initialsFor,
  matchContributor,
  toCsv,
  toMarkdownTable,
} from "@/lib/github";

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

const PAGE_SIZE = 25;

const actionButtonClass =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-sm border border-border-default bg-surface text-ink transition-colors duration-150 hover:border-border-strong hover:bg-surface-raised active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]";

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M3 10.5V3.5C3 2.94772 3.44772 2.5 4 2.5H10.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 text-accent-bright" fill="none" aria-hidden="true">
      <path
        d="M3 8.5L6.2 11.5L13 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <path
        d="M8 2.5V10M8 10L5 7M8 10L11 7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 12.5H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M13 13L10.3 10.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <path
        d="M4 4L12 12M4 12L12 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "M10 3.5L5.5 8L10 12.5" : "M6 3.5L10.5 8L6 12.5"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Heroicons "photo" outline icon (MIT licensed, tailwindlabs/heroicons). */
function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
      />
    </svg>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border-default bg-accent-dim font-sans text-[0.5625rem] font-medium text-accent-bright"
        aria-hidden="true"
      >
        {initialsFor(name)}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      className="rounded-full border border-border-default"
      onError={() => setErrored(true)}
    />
  );
}

function HighlightedText({ text, indices }: { text: string; indices?: number[] }) {
  if (!indices || indices.length === 0) return <>{text}</>;
  const hit = new Set(indices);
  return (
    <>
      {Array.from(text).map((ch, i) =>
        hit.has(i) ? (
          <mark
            key={i}
            className="rounded-[2px] bg-accent-dim text-accent-bright"
            style={{ padding: 0 }}
          >
            {ch}
          </mark>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  );
}

export function ResultsTable({
  repoLabel,
  repoPath,
  contributors,
  columns,
  limit,
  embedEnabled,
}: {
  repoLabel: string;
  repoPath: { owner: string; repo: string };
  contributors: Contributor[];
  columns: Record<ColumnKey, boolean>;
  limit: number | null;
  embedEnabled: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewErrored, setPreviewErrored] = useState(false);

  const cardUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/api/card/${repoPath.owner}/${repoPath.repo}`;

  // "Show top N" is a display default, not a search boundary: search always
  // reaches the full contributor list, so someone outside the top N is still
  // findable. Exports and the header stat stay scoped to the limited view,
  // matching what "Show top N" has always meant.
  const limitedContributors = useMemo(
    () => (limit ? contributors.slice(0, limit) : contributors),
    [contributors, limit],
  );
  const totalCommits = limitedContributors.reduce((sum, c) => sum + c.commits, 0);

  // Rank always reflects each contributor's position in the overall (sorted)
  // list, not their position within the currently displayed/search-reordered
  // rows — otherwise searching would relabel everyone as 1, 2, 3, ...
  const rankByKey = useMemo(() => {
    const map = new Map<string, number>();
    contributors.forEach((c, i) => map.set(c.key, i + 1));
    return map;
  }, [contributors]);

  const matches = useMemo(() => {
    const map = new Map<string, ContributorMatch>();
    if (!query.trim()) return map;
    for (const c of contributors) {
      const m = matchContributor(query, c);
      if (m) map.set(c.key, m);
    }
    return map;
  }, [query, contributors]);

  const isSearching = query.trim().length > 0;

  const displayedContributors = useMemo(() => {
    if (!isSearching) return limitedContributors;
    const matched: Contributor[] = [];
    const unmatched: Contributor[] = [];
    for (const c of contributors) {
      (matches.has(c.key) ? matched : unmatched).push(c);
    }
    matched.sort((a, b) => matches.get(b.key)!.score - matches.get(a.key)!.score);
    return [...matched, ...unmatched];
  }, [contributors, limitedContributors, matches, isSearching]);

  const pageCount = Math.max(1, Math.ceil(displayedContributors.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedContributors = useMemo(
    () => displayedContributors.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [displayedContributors, currentPage],
  );

  function handleSearchChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  async function handleCopyMarkdown() {
    const markdown = toMarkdownTable(limitedContributors, columns);
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function handleCopyEmbed() {
    const snippet = `[![Contributors](${cardUrl})](${BLAME_SITE_URL})`;
    await navigator.clipboard.writeText(snippet);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 1800);
  }

  function handleDownloadCsv() {
    const csv = toCsv(limitedContributors, columns);
    const safeName = repoLabel.replace(/[^\w.-]+/g, "-");
    downloadFile(`${safeName}-contributors.csv`, csv, "text/csv;charset=utf-8");
  }

  if (contributors.length === 0) {
    return (
      <div className="rounded-md border border-border-default bg-surface px-6 py-10 text-center">
        <p className="font-sans text-[0.9375rem] text-ink-secondary">
          No contributors found — this repository has no commits matching your filters.
        </p>
      </div>
    );
  }

  const searchField = (className: string) => (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-8 items-center justify-center text-ink-muted">
        <SearchIcon />
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Search"
        autoComplete="off"
        spellCheck={false}
        aria-label="Search contributors by name, username, or email"
        className="h-9 w-full rounded-sm border border-border-strong bg-canvas py-1.5 pl-8 pr-8 font-sans text-[0.8125rem] text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:shadow-[var(--shadow-focus-ring)]"
      />
      {query && (
        <button
          type="button"
          onClick={() => handleSearchChange("")}
          aria-label="Clear search"
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-ink-muted transition-colors hover:text-ink"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-sans text-[1.375rem] font-semibold text-ink">Contributors</h2>
          <p className="font-mono text-[0.8125rem] text-ink-secondary">
            {isSearching ? (
              <>
                {matches.size} {matches.size === 1 ? "match" : "matches"} of {contributors.length}
              </>
            ) : (
              <>
                {limitedContributors.length}{" "}
                {limitedContributors.length === 1 ? "person" : "people"} ·{" "}
                {totalCommits.toLocaleString()} commits
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {searchField("hidden w-48 sm:block")}

          <button
            type="button"
            onClick={handleCopyMarkdown}
            className={actionButtonClass}
            aria-label={copied ? "Copied" : "Copy as markdown"}
            title={copied ? "Copied" : "Copy as markdown"}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className={actionButtonClass}
            aria-label="Download CSV"
            title="Download CSV"
          >
            <DownloadIcon />
          </button>
          {embedEnabled && (
            <button
              type="button"
              onClick={handleCopyEmbed}
              className={actionButtonClass}
              aria-label={embedCopied ? "Embed snippet copied" : "Copy README embed snippet"}
              title={embedCopied ? "Embed snippet copied" : "Copy README embed snippet"}
            >
              {embedCopied ? <CheckIcon /> : <ImageIcon />}
            </button>
          )}
        </div>
      </div>

      {searchField("sm:hidden")}

      <div className="overflow-x-auto rounded-md border border-border-default">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-raised">
              <th className="px-4 py-3 text-right font-sans text-[1rem] font-medium text-ink-secondary">
                #
              </th>
              <th className="px-4 py-3 font-sans text-[1rem] font-medium text-ink-secondary">
                Name
              </th>
              {columns.username && (
                <th className="px-4 py-3 font-sans text-[1rem] font-medium text-ink-secondary">
                  Username
                </th>
              )}
              {columns.email && (
                <th className="px-4 py-3 font-sans text-[1rem] font-medium text-ink-secondary">
                  Email
                </th>
              )}
              <th className="px-4 py-3 text-right font-sans text-[1rem] font-medium text-ink-secondary">
                Commits
              </th>
              {columns.firstCommit && (
                <th className="px-4 py-3 font-sans text-[1rem] font-medium text-ink-secondary">
                  First commit
                </th>
              )}
              {columns.lastCommit && (
                <th className="px-4 py-3 font-sans text-[1rem] font-medium text-ink-secondary">
                  Last commit
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pagedContributors.map((c) => {
              const match = matches.get(c.key);
              const isDimmed = isSearching && !match;
              const rank = rankByKey.get(c.key) ?? 0;
              return (
                <tr
                  key={c.key}
                  className={`border-t border-border-default bg-surface transition-opacity duration-150 hover:bg-surface-raised ${
                    isDimmed ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-right font-mono text-[0.8125rem] text-ink-muted">
                    {rank}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={c.avatarUrl} name={c.name} />
                      <span className="font-sans text-[0.9375rem] text-ink">
                        <HighlightedText text={c.name} indices={match?.fields.name} />
                      </span>
                    </div>
                  </td>
                  {columns.username && (
                    <td className="px-4 py-3 font-mono text-[0.8125rem] text-ink-secondary">
                      {c.username ? (
                        <>
                          @<HighlightedText text={c.username} indices={match?.fields.username} />
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {columns.email && (
                    <td className="px-4 py-3 font-mono text-[0.8125rem] text-ink-secondary">
                      {c.email ? (
                        <HighlightedText text={c.email} indices={match?.fields.email} />
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-mono text-[0.8125rem] text-accent-bright">
                    {c.commits.toLocaleString()}
                  </td>
                  {columns.firstCommit && (
                    <td className="px-4 py-3 font-mono text-[0.8125rem] text-ink-muted">
                      {formatDate(c.firstCommit)}
                    </td>
                  )}
                  {columns.lastCommit && (
                    <td className="px-4 py-3 font-mono text-[0.8125rem] text-ink-muted">
                      {formatDate(c.lastCommit)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className="inline-flex size-8 items-center justify-center rounded-sm border border-border-default bg-surface text-ink transition-colors duration-150 hover:border-border-strong hover:bg-surface-raised active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
          >
            <ChevronIcon direction="left" />
          </button>
          <span className="font-mono text-[0.8125rem] text-ink-secondary">
            Page {currentPage} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={currentPage === pageCount}
            aria-label="Next page"
            className="inline-flex size-8 items-center justify-center rounded-sm border border-border-default bg-surface text-ink transition-colors duration-150 hover:border-border-strong hover:bg-surface-raised active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
      )}

      {embedEnabled && (
        <div className="flex flex-col gap-2 rounded-md border border-border-default bg-surface p-4">
          <span className="font-sans text-[0.8125rem] font-medium text-ink-secondary">
            Embed preview
          </span>

          {!previewLoaded && !previewErrored && (
            <div className="flex h-56 w-full flex-col items-center justify-center gap-3 rounded-sm border border-border-default bg-canvas">
              <span className="relative flex size-4 items-center justify-center" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-accent shadow-[var(--shadow-focus-ring)] motion-safe:animate-[pulse-dot_1.4s_ease-in-out_infinite]" />
              </span>
              <span className="font-mono text-[0.8125rem] text-ink-muted">
                Generating preview…
              </span>
            </div>
          )}

          {previewErrored && (
            <div className="flex h-32 w-full items-center justify-center rounded-sm border border-danger bg-danger-dim">
              <span className="font-sans text-[0.8125rem] text-danger">
                Couldn&apos;t generate the preview. Try again in a moment.
              </span>
            </div>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element -- dimensions are dynamic (repo-dependent), can't be known ahead of time for next/image */}
          <img
            src={cardUrl}
            alt={`Contributor card preview for ${repoPath.owner}/${repoPath.repo}`}
            onLoad={() => setPreviewLoaded(true)}
            onError={() => setPreviewErrored(true)}
            className={`h-auto max-w-full rounded-sm border border-border-default ${
              previewLoaded ? "block" : "hidden"
            }`}
          />
        </div>
      )}
    </section>
  );
}
