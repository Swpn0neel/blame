"use client";

import Image from "next/image";
import { useState } from "react";
import {
  type ColumnKey,
  type Contributor,
  downloadFile,
  toCsv,
  toMarkdownTable,
} from "@/lib/github";

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

const actionButtonClass =
  "inline-flex items-center gap-2 rounded-sm border border-border-default bg-surface px-4 py-2 font-sans text-[0.8125rem] font-medium text-ink transition-colors duration-150 hover:border-border-strong hover:bg-surface-raised active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]";

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

export function ResultsTable({
  repoLabel,
  contributors,
  columns,
}: {
  repoLabel: string;
  contributors: Contributor[];
  columns: Record<ColumnKey, boolean>;
}) {
  const [copied, setCopied] = useState(false);
  const totalCommits = contributors.reduce((sum, c) => sum + c.commits, 0);

  async function handleCopyMarkdown() {
    const markdown = toMarkdownTable(contributors, columns);
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownloadCsv() {
    const csv = toCsv(contributors, columns);
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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-sans text-[1.375rem] font-semibold text-ink">Contributors</h2>
          <p className="font-mono text-[0.8125rem] text-ink-secondary">
            {contributors.length} {contributors.length === 1 ? "person" : "people"} ·{" "}
            {totalCommits.toLocaleString()} commits
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleCopyMarkdown} className={actionButtonClass}>
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy as markdown"}
          </button>
          <button type="button" onClick={handleDownloadCsv} className={actionButtonClass}>
            <DownloadIcon />
            Download CSV
          </button>
        </div>
      </div>

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
            {contributors.map((c) => (
              <tr
                key={c.key}
                className="border-t border-border-default bg-surface transition-colors hover:bg-surface-raised"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {c.avatarUrl ? (
                      <Image
                        src={c.avatarUrl}
                        alt=""
                        aria-hidden="true"
                        width={24}
                        height={24}
                        className="rounded-full border border-border-default"
                      />
                    ) : (
                      <span
                        className="size-6 shrink-0 rounded-full border border-border-default bg-surface-raised"
                        aria-hidden="true"
                      />
                    )}
                    <span className="font-sans text-[0.9375rem] text-ink">{c.name}</span>
                  </div>
                </td>
                {columns.username && (
                  <td className="px-4 py-3 font-mono text-[0.8125rem] text-ink-secondary">
                    {c.username ? `@${c.username}` : "—"}
                  </td>
                )}
                {columns.email && (
                  <td className="px-4 py-3 font-mono text-[0.8125rem] text-ink-secondary">
                    {c.email || "—"}
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
