const EMBERS = [
  { x: "8%", y: "18%", delay: "0s", duration: "5.5s" },
  { x: "22%", y: "62%", delay: "1.2s", duration: "6.2s" },
  { x: "14%", y: "84%", delay: "2.4s", duration: "4.8s" },
  { x: "37%", y: "10%", delay: "0.6s", duration: "5.8s" },
  { x: "46%", y: "72%", delay: "3.1s", duration: "6.6s" },
  { x: "61%", y: "28%", delay: "1.8s", duration: "5.2s" },
  { x: "68%", y: "88%", delay: "0.3s", duration: "6.9s" },
  { x: "78%", y: "46%", delay: "2.7s", duration: "5.6s" },
  { x: "85%", y: "15%", delay: "1.5s", duration: "6.1s" },
  { x: "92%", y: "66%", delay: "3.6s", duration: "5.0s" },
  { x: "30%", y: "40%", delay: "4.1s", duration: "6.4s" },
  { x: "55%", y: "55%", delay: "0.9s", duration: "5.4s" },
];

const FADE_MASK =
  "radial-gradient(ellipse 55% 45% at 50% 38%, transparent 0%, black 75%)";

export function Background() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
      style={{
        maskImage: FADE_MASK,
        WebkitMaskImage: FADE_MASK,
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.07] motion-safe:animate-[drift-grid_60s_linear_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--border-strong) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Hidden below sm: narrow viewports leave too little margin for these
          to avoid sitting on top of text. */}
      <div className="hidden sm:contents">
        {EMBERS.map((ember, i) => (
          <span
            key={i}
            className="absolute size-[3px] rounded-full bg-accent-bright motion-reduce:opacity-30 motion-safe:animate-[ember-pulse_var(--dur)_ease-in-out_infinite]"
            style={
              {
                left: ember.x,
                top: ember.y,
                animationDelay: ember.delay,
                "--dur": ember.duration,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
