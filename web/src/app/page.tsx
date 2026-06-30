import { BlameApp } from "@/components/BlameApp";
import { Background } from "@/components/Background";

export default function Home() {
  return (
    <>
      <Background />
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center gap-12 px-6 py-20 sm:py-28">
        <div className="flex flex-col items-center gap-5 text-center">
          <h1 className="text-balance font-display text-[clamp(3.5rem,11vw,6rem)] leading-[1.1] tracking-[0.01em] text-ink">
            blame
          </h1>
          <p className="max-w-md text-pretty font-sans text-[0.9375rem] leading-relaxed text-ink-secondary">
            Paste a GitHub repo. Get a table of everyone who actually committed:
            name, username, email, commit count.
            {/* Copy as markdown or pull a CSV. */}
          </p>
        </div>

        <div className="w-full">
          <BlameApp />
        </div>

        <footer className="mt-8 max-w-md text-center font-sans text-[0.8125rem] text-ink-muted">
          Reads public commit history straight from the GitHub API, from your browser. Nothing you
          scan is stored anywhere.
        </footer>
      </main>
    </>
  );
}
