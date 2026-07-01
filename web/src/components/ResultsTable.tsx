"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  type ColumnKey,
  type Contributor,
  type ContributorMatch,
  downloadFile,
  matchContributor,
  toCsv,
  toMarkdownTable,
} from "@/lib/github";

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

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

function Avatar({ src }: { src: string | null }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <span
        className="size-6 shrink-0 rounded-full border border-border-default bg-surface-raised"
        aria-hidden="true"
      />
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
  contributors,
  columns,
  limit,
}: {
  repoLabel: string;
  contributors: Contributor[];
  columns: Record<ColumnKey, boolean>;
  limit: number | null;
}) {
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");

  // "Show top N" is a display default, not a search boundary: search always
  // reaches the full contributor list, so someone outside the top N is still
  // findable. Exports and the header stat stay scoped to the limited view,
  // matching what "Show top N" has always meant.
  const limitedContributors = useMemo(
    () => (limit ? contributors.slice(0, limit) : contributors),
    [contributors, limit],
  );
  const totalCommits = limitedContributors.reduce((sum, c) => sum + c.commits, 0);

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

  async function handleCopyMarkdown() {
    const markdown = toMarkdownTable(limitedContributors, columns);
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        autoComplete="off"
        spellCheck={false}
        aria-label="Search contributors by name, username, or email"
        className="h-9 w-full rounded-sm border border-border-strong bg-canvas py-1.5 pl-8 pr-8 font-sans text-[0.8125rem] text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:shadow-[var(--shadow-focus-ring)]"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
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
        </div>
      </div>

      {searchField("sm:hidden")}

      <div className="overflow-x-auto rounded-md border border-border-default">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-raised">
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
            {displayedContributors.map((c) => {
              const match = matches.get(c.key);
              const isDimmed = isSearching && !match;
              return (
                <tr
                  key={c.key}
                  className={`border-t border-border-default bg-surface transition-opacity duration-150 hover:bg-surface-raised ${
                    isDimmed ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={c.avatarUrl} />
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
    </section>
  );
}
