export type StepStatus = "pending" | "active" | "done" | "error";

export type ScanStep = {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
};

function StepGlyph({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <svg
        viewBox="0 0 16 16"
        className="size-3.5 shrink-0 text-accent"
        aria-hidden="true"
        fill="none"
      >
        <path
          d="M3 8.5L6.2 11.5L13 4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === "error") {
    return (
      <svg
        viewBox="0 0 16 16"
        className="size-3.5 shrink-0 text-danger"
        aria-hidden="true"
        fill="none"
      >
        <path
          d="M4 4L12 12M12 4L4 12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (status === "active") {
    return (
      <span
        className="relative flex size-3.5 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        <span className="size-2 rounded-full bg-accent shadow-[var(--shadow-focus-ring)] motion-safe:animate-[pulse-dot_1.4s_ease-in-out_infinite]" />
      </span>
    );
  }

  return (
    <span
      className="size-2.5 shrink-0 rounded-full border border-ink-muted"
      aria-hidden="true"
    />
  );
}

export function ScanLog({ steps }: { steps: ScanStep[] }) {
  return (
    <ol className="flex flex-col gap-2.5 font-mono text-[0.8125rem]" aria-label="Scan progress">
      {steps.map((step) => (
        <li
          key={step.id}
          className="flex items-center gap-3 motion-safe:animate-[fade-rise_180ms_ease-out]"
        >
          <StepGlyph status={step.status} />
          <span
            className={
              step.status === "pending"
                ? "text-ink-muted"
                : step.status === "error"
                  ? "text-danger"
                  : "text-ink"
            }
          >
            {step.label}
          </span>
          {step.detail && (
            <span className="text-ink-secondary">— {step.detail}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
