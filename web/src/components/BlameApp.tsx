"use client";

import { useState } from "react";
import {
  GithubApiError,
  LARGE_REPO_WARNING_THRESHOLD,
  aggregateContributors,
  estimateCommitCount,
  fetchAllCommits,
  filterHasEmail,
  parseRepoInput,
  sortContributors,
  verifyRepoExists,
  type ColumnKey,
  type Contributor,
} from "@/lib/github";
import { ScanForm, type ScanOptions } from "@/components/ScanForm";
import { ScanLog, type ScanStep } from "@/components/ScanLog";
import { ResultsTable } from "@/components/ResultsTable";

type Status = "idle" | "running" | "success" | "error";

const STEP_DEFS = [
  { id: "resolve", label: "Resolving repository" },
  { id: "fetch", label: "Fetching commit history" },
  { id: "aggregate", label: "Aggregating authors" },
  { id: "done", label: "Done" },
];

function initialSteps(): ScanStep[] {
  return STEP_DEFS.map((s) => ({ ...s, status: "pending" as const }));
}

function withMinDuration<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.all([promise, new Promise((resolve) => setTimeout(resolve, ms))]).then(
    ([result]) => result,
  );
}

export function BlameApp() {
  const [status, setStatus] = useState<Status>("idle");
  const [steps, setSteps] = useState<ScanStep[]>(initialSteps());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>({
    username: true,
    email: true,
    firstCommit: false,
    lastCommit: false,
  });
  const [repoLabel, setRepoLabel] = useState("");
  const [limit, setLimit] = useState<number | null>(null);

  function setStep(id: string, patch: Partial<ScanStep>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function handleRun(repoInput: string, options: ScanOptions) {
    setStatus("running");
    setErrorMessage(null);
    setWarningMessage(null);
    setContributors([]);
    setSteps(initialSteps());
    setColumns(options.columns);
    setLimit(options.limit);

    let owner = "";
    let repo = "";

    try {
      setStep("resolve", { status: "active" });
      const parsed = parseRepoInput(repoInput);
      owner = parsed.owner;
      repo = parsed.repo;
      setRepoLabel(`${owner}-${repo}`);
      await withMinDuration(verifyRepoExists(owner, repo, options.token), 450);
      setStep("resolve", { status: "done" });

      if (!options.token) {
        const estimate = await estimateCommitCount(owner, repo, options.token);
        if (estimate && estimate > LARGE_REPO_WARNING_THRESHOLD) {
          setWarningMessage(
            `This repo has roughly ${estimate.toLocaleString()} commits — an unauthenticated ` +
              "scan may hit GitHub's rate limit partway through. Add a token below to avoid that.",
          );
        }
      }

      setStep("fetch", { status: "active", detail: "0 commits" });
      const commits = await withMinDuration(
        fetchAllCommits(owner, repo, options.token, (count, truncated) => {
          setStep("fetch", {
            status: "active",
            detail: truncated ? `${count.toLocaleString()}+ commits (capped)` : `${count.toLocaleString()} commits`,
          });
        }),
        450,
      );
      setStep("fetch", {
        status: "done",
        detail: `${commits.length.toLocaleString()} commits`,
      });

      setStep("aggregate", { status: "active" });
      let people = await withMinDuration(
        Promise.resolve(aggregateContributors(commits, options.includeMerges)),
        350,
      );
      if (options.hasEmail) people = filterHasEmail(people);
      people = sortContributors(people, options.sortBy);
      setStep("aggregate", { status: "done", detail: `${people.length} people` });

      setStep("done", { status: "done" });
      setContributors(people);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof GithubApiError || err instanceof Error
          ? err.message
          : "Something went wrong while scanning that repository.";
      setSteps((prev) =>
        prev.map((s) => (s.status === "active" ? { ...s, status: "error" as const } : s)),
      );
      setErrorMessage(message);
      setStatus("error");
    }
  }

  return (
    <div className="flex w-full flex-col gap-10">
      <ScanForm onRun={handleRun} disabled={status === "running"} />

      {status !== "idle" && (
        <div className="flex flex-col gap-3 rounded-md border border-border-default bg-surface p-5">
          <ScanLog steps={steps} />
          {warningMessage && (
            <p
              role="status"
              className="rounded-sm border border-accent bg-accent-dim px-3 py-2 font-sans text-[0.8125rem] text-accent-bright"
            >
              {warningMessage}
            </p>
          )}
          {status === "error" && errorMessage && (
            <p
              role="alert"
              className="rounded-sm border border-danger bg-danger-dim px-3 py-2 font-sans text-[0.8125rem] text-danger"
            >
              {errorMessage}
            </p>
          )}
        </div>
      )}

      {status === "success" && (
        <ResultsTable
          repoLabel={repoLabel}
          contributors={contributors}
          columns={columns}
          limit={limit}
        />
      )}
    </div>
  );
}
