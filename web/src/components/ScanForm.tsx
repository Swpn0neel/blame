"use client";

import { useEffect, useId, useState } from "react";
import type { ColumnKey, SortBy } from "@/lib/github";
import { COLUMN_LABELS } from "@/lib/github";

const TOKEN_STORAGE_KEY = "blame:github-token";

export type ScanOptions = {
  hasEmail: boolean;
  excludeBots: boolean;
  embedEnabled: boolean;
  sortBy: SortBy;
  limit: number | null;
  columns: Record<ColumnKey, boolean>;
  token: string | null;
};

const COLUMN_KEYS: ColumnKey[] = [
  "username",
  "email",
  "firstCommit",
  "lastCommit",
];

const fieldClass =
  "rounded-sm border border-border-strong bg-canvas font-mono text-[0.8125rem] text-ink placeholder:font-sans placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:shadow-[var(--shadow-focus-ring)]";

function Pill({
  pressed,
  onClick,
  children,
  className = "",
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full border px-3.5 py-1.5 font-sans text-[0.8125rem] font-medium transition-colors duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] ${
        pressed
          ? "border-transparent bg-accent-dim text-accent-bright"
          : "border-border-strong bg-transparent text-ink-secondary hover:border-accent hover:bg-surface-raised"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-sans text-[0.8125rem] font-medium text-ink-secondary"
    >
      {children}
    </label>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        viewBox="0 0 16 16"
        className="size-4"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1.5 8S4 3 8 3s6.5 5 6.5 5-2.5 5-6.5 5-6.5-5-6.5-5Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path
        d="M2 2L14 14M6.6 6.7C6.2 7.1 6 7.5 6 8C6 9.1 6.9 10 8 10C8.5 10 8.9 9.8 9.3 9.5M4.2 4.4C2.6 5.4 1.5 8 1.5 8S4 13 8 13C9.2 13 10.3 12.6 11.1 12M13 10.3C13.9 9.3 14.5 8 14.5 8S12 3 8 3C7.7 3 7.4 3 7.1 3.1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ScanForm({
  onRun,
  disabled,
}: {
  onRun: (repoInput: string, options: ScanOptions) => void;
  disabled: boolean;
}) {
  const urlId = useId();
  const tokenId = useId();
  const limitId = useId();
  const sortId = useId();

  const [repoInput, setRepoInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [appliedToken, setAppliedToken] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [rememberToken, setRememberToken] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [excludeBots, setExcludeBots] = useState(true);
  const [embedEnabled, setEmbedEnabled] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("commits");
  const [limit, setLimit] = useState("");
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>({
    username: true,
    email: true,
    firstCommit: false,
    lastCommit: false,
  });

  // Opt-in only: a remembered token lives in this browser's localStorage, never
  // sent anywhere but api.github.com. Load it once on mount — localStorage
  // doesn't exist during SSR, so this can't be a lazy useState initializer.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from a browser-only API, not a derived-state anti-pattern */
  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (saved) {
      setTokenDraft(saved);
      setAppliedToken(saved);
      setRememberToken(true);
      setShowToken(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const tokenIsDirty = tokenDraft.trim() !== (appliedToken ?? "");

  function toggleColumn(key: ColumnKey) {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleApplyToken() {
    const trimmed = tokenDraft.trim();
    setAppliedToken(trimmed || null);
    if (rememberToken) {
      if (trimmed) window.localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
      else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }

  function handleToggleRemember() {
    setRememberToken((prev) => {
      const next = !prev;
      if (next && appliedToken) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, appliedToken);
      } else if (!next) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedLimit = limit.trim() ? Math.max(1, parseInt(limit, 10)) : null;
    onRun(repoInput, {
      hasEmail,
      excludeBots,
      embedEnabled,
      sortBy,
      limit: parsedLimit,
      columns,
      token: appliedToken,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={urlId} className="sr-only">
          GitHub repository URL
        </label>
        <input
          id={urlId}
          type="text"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          placeholder="github.com/owner/repo or owner/repo"
          autoComplete="off"
          spellCheck={false}
          className={`${fieldClass} h-12 w-full shrink-0 px-4 sm:flex-1`}
        />
        <button
          type="submit"
          disabled={disabled}
          className="h-12 shrink-0 rounded-sm bg-accent px-6 font-sans text-[0.8125rem] font-medium text-white transition-colors duration-150 hover:bg-accent-bright active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
        >
          {disabled ? "Scanning…" : "Run scan"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowToken((v) => !v)}
        className="self-start font-sans text-[0.8125rem] font-medium text-ink-secondary underline decoration-border-strong underline-offset-4 transition-colors hover:text-accent-bright hover:decoration-accent-bright"
      >
        {showToken ? "Hide token field" : "Using a large repo? Add a token"}
      </button>

      {showToken && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={tokenId}>
            GitHub personal access token (optional)
          </FieldLabel>
          <div className="flex max-w-md gap-2">
            <div className="relative flex-1">
              <input
                id={tokenId}
                type={tokenVisible ? "text" : "password"}
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyToken();
                  }
                }}
                placeholder="github_pat..."
                autoComplete="off"
                spellCheck={false}
                className={`${fieldClass} h-10 w-full pl-3 pr-9`}
              />
              <button
                type="button"
                onClick={() => setTokenVisible((v) => !v)}
                aria-label={tokenVisible ? "Hide token" : "Show token"}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-muted transition-colors hover:text-ink"
              >
                <EyeIcon open={tokenVisible} />
              </button>
            </div>
            <button
              type="button"
              onClick={handleApplyToken}
              disabled={!tokenIsDirty}
              className="shrink-0 rounded-sm border border-border-strong px-4 font-sans text-[0.8125rem] font-medium text-ink transition-colors duration-150 hover:border-accent hover:bg-surface-raised active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              Apply
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Pill pressed={rememberToken} onClick={handleToggleRemember}>
              {rememberToken ? "Remembered" : "Remember token"}
            </Pill>
          </div>

          <p className="flex max-w-md items-center gap-1.5 font-sans text-[0.8125rem]">
            {appliedToken && !tokenIsDirty ? (
              <span className="flex items-center gap-1.5 text-accent-bright">
                <svg
                  viewBox="0 0 16 16"
                  className="size-3.5 shrink-0"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8.5L6.2 11.5L13 4.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Token applied —{" "}
                {rememberToken
                  ? "remembered in this browser"
                  : "cleared on reload"}
              </span>
            ) : (
              <span className="text-ink-muted">
                Sent directly to api.github.com from your browser. Never stored
                unless you turn on “Remember token.”
              </span>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-md border border-border-default bg-surface p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:flex sm:flex-wrap sm:items-end sm:gap-x-6">
          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-[0.8125rem] font-medium text-ink-secondary">
              Public email
            </span>
            <Pill pressed={hasEmail} onClick={() => setHasEmail((v) => !v)}>
              {hasEmail ? "Required" : "Optional"}
            </Pill>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-[0.8125rem] font-medium text-ink-secondary">
              Bots
            </span>
            <Pill
              pressed={excludeBots}
              onClick={() => setExcludeBots((v) => !v)}
            >
              {excludeBots ? "Excluded" : "Included"}
            </Pill>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="font-sans text-[0.8125rem] font-medium text-ink-secondary">
              Embed image
            </span>
            <Pill pressed={embedEnabled} onClick={() => setEmbedEnabled((v) => !v)}>
              {embedEnabled ? "Enabled" : "Disabled"}
            </Pill>
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={sortId}>Sort by</FieldLabel>
            <select
              id={sortId}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className={`${fieldClass} h-9 w-full pl-2.5 sm:w-auto`}
            >
              <option value="commits">Most commits</option>
              <option value="name">Name</option>
              <option value="recent">Most recent</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={limitId}>Show top</FieldLabel>
            <input
              id={limitId}
              type="number"
              min={1}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="All"
              className={`${fieldClass} h-9 w-full px-2.5 sm:w-20`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border-default pt-4">
          <span className="font-sans text-[0.8125rem] font-medium text-ink-secondary">
            Columns
          </span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {COLUMN_KEYS.map((key) => (
              <Pill
                key={key}
                pressed={columns[key]}
                onClick={() => toggleColumn(key)}
                className="w-full sm:w-auto"
              >
                {COLUMN_LABELS[key]}
              </Pill>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}
