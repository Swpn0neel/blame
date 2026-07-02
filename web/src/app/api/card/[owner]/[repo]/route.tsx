import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  aggregateContributors,
  fetchAllCommits,
  filterBots,
  initialsFor,
  sortContributors,
  verifyRepoExists,
  type Contributor,
} from "@/lib/github";

export const runtime = "nodejs";
export const revalidate = 86400; // 24h — Next's route segment config requires a literal here

const CACHE_SECONDS = 86400; // 24h
const ERROR_CACHE_SECONDS = 300; // 5m, so a transient failure self-heals quickly

const CANVAS = "#0A0D11";
const BORDER = "#21262D";
const INK = "#E6EDF3";
const INK_SECONDARY = "#8B949E";
const ACCENT = "#58A6FF";
const ACCENT_DIM = "#112D4E";
const DANGER = "#F85149";

// --- Layout: table (top 5, name + commits) on the left, everyone else up to
// MAX_GRID as an avatar-only grid (max 9 per row) on the right. Width and
// height both grow with how many contributors are actually being shown.
const MAX_TABLE_ROWS = 5;
const MAX_GRID_CONTRIBUTORS = 45;
const MAX_GRID_COLS = 9;

const PADDING = 28;
const HEADER_HEIGHT = 32;
const FOOTER_HEIGHT = 36;
const SECTION_GAP_Y = 18;
const SECTION_GAP_X = 28;

const TABLE_WIDTH = 300;
const TABLE_ROW_HEIGHT = 40;
const TABLE_AVATAR_SIZE = 24;

const GRID_AVATAR_SIZE = 28;
const GRID_GAP = 8;

let silkscreenData: Buffer | null = null;
function silkscreenFont(): Buffer {
  if (!silkscreenData) {
    silkscreenData = readFileSync(join(process.cwd(), "src/assets/card/Silkscreen-Regular.ttf"));
  }
  return silkscreenData;
}

let spaceGroteskData: Buffer | null = null;
function spaceGroteskFont(): Buffer {
  if (!spaceGroteskData) {
    spaceGroteskData = readFileSync(
      join(process.cwd(), "src/assets/card/SpaceGrotesk-Regular.woff"),
    );
  }
  return spaceGroteskData;
}

function cacheHeaders(seconds: number): HeadersInit {
  return {
    "Cache-Control": `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=${seconds}`,
  };
}

async function renderImage(
  tree: React.ReactNode,
  width: number,
  height: number,
  cacheSeconds: number,
) {
  return new ImageResponse(tree as React.ReactElement, {
    width,
    height,
    headers: cacheHeaders(cacheSeconds),
    fonts: [
      { name: "Space Grotesk", data: spaceGroteskFont(), weight: 400, style: "normal" },
      { name: "Silkscreen", data: silkscreenFont(), weight: 400, style: "normal" },
    ],
  });
}

function errorCard(message: string) {
  const width = PADDING * 2 + TABLE_WIDTH;
  const height = 120;
  return renderImage(
    <div
      style={{
        width,
        height,
        background: CANVAS,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: PADDING,
        fontFamily: "Space Grotesk",
      }}
    >
      <div style={{ display: "flex", color: DANGER, fontSize: 14, textAlign: "center" }}>
        {message}
      </div>
    </div>,
    width,
    height,
    ERROR_CACHE_SECONDS,
  );
}

function AvatarCircle({
  src,
  size,
  name,
}: {
  src: string | null;
  size: number;
  name: string;
}) {
  if (!src) {
    return (
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          borderRadius: "50%",
          background: ACCENT_DIM,
          border: `1px solid ${BORDER}`,
          alignItems: "center",
          justifyContent: "center",
          color: ACCENT,
          fontSize: Math.max(9, Math.round(size * 0.4)),
          fontWeight: 600,
        }}
      >
        {initialsFor(name)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>, not next/image
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      style={{ borderRadius: "50%", border: `1px solid ${BORDER}` }}
    />
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await params;
  const token = process.env.GITHUB_TOKEN || null;

  try {
    await verifyRepoExists(owner, repo, token);
    const commits = await fetchAllCommits(owner, repo, token, () => {});
    let people = aggregateContributors(commits);
    people = filterBots(people);
    people = sortContributors(people, "commits");

    if (people.length === 0) {
      return errorCard(`No contributors found for ${owner}/${repo}.`);
    }

    const totalCommits = people.reduce((sum, c) => sum + c.commits, 0);
    const table = people.slice(0, MAX_TABLE_ROWS);
    const grid = people.slice(MAX_TABLE_ROWS, MAX_TABLE_ROWS + MAX_GRID_CONTRIBUTORS);

    const hasGrid = grid.length > 0;
    const gridCols = hasGrid ? Math.min(grid.length, MAX_GRID_COLS) : 0;
    const gridRows = hasGrid ? Math.ceil(grid.length / MAX_GRID_COLS) : 0;
    const gridWidth = hasGrid ? gridCols * GRID_AVATAR_SIZE + (gridCols - 1) * GRID_GAP : 0;
    const gridHeight = hasGrid ? gridRows * GRID_AVATAR_SIZE + (gridRows - 1) * GRID_GAP : 0;

    const tableHeight = table.length * TABLE_ROW_HEIGHT;
    const bodyHeight = Math.max(tableHeight, gridHeight);

    const width = PADDING * 2 + TABLE_WIDTH + (hasGrid ? SECTION_GAP_X + gridWidth : 0);
    const height =
      PADDING * 2 + HEADER_HEIGHT + SECTION_GAP_Y + bodyHeight + SECTION_GAP_Y + FOOTER_HEIGHT;

    return renderImage(
      <div
        style={{
          width,
          height,
          background: CANVAS,
          display: "flex",
          flexDirection: "column",
          padding: PADDING,
          fontFamily: "Space Grotesk",
        }}
      >
        <div style={{ display: "flex", height: HEADER_HEIGHT, alignItems: "center" }}>
          <div style={{ display: "flex", color: INK, fontSize: 20, fontWeight: 600 }}>
            {owner}/{repo}
          </div>
        </div>

        <div style={{ display: "flex", height: SECTION_GAP_Y }} />

        <div style={{ display: "flex", flexDirection: "row", height: bodyHeight }}>
          <div style={{ display: "flex", flexDirection: "column", width: TABLE_WIDTH }}>
            {table.map((c: Contributor, i: number) => (
              <div
                key={c.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  height: TABLE_ROW_HEIGHT,
                  borderTop: i === 0 ? "none" : `1px solid ${BORDER}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AvatarCircle src={c.avatarUrl} size={TABLE_AVATAR_SIZE} name={c.name} />
                  <div style={{ display: "flex", color: INK, fontSize: 14 }}>{c.name}</div>
                </div>
                <div style={{ display: "flex", color: ACCENT, fontSize: 12 }}>
                  {c.commits.toLocaleString()} commits
                </div>
              </div>
            ))}
          </div>

          {hasGrid && (
            <>
              <div style={{ display: "flex", width: SECTION_GAP_X }} />
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  width: gridWidth,
                  height: gridHeight,
                  gap: GRID_GAP,
                  alignContent: "flex-start",
                }}
              >
                {grid.map((c) => (
                  <AvatarCircle key={c.key} src={c.avatarUrl} size={GRID_AVATAR_SIZE} name={c.name} />
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", height: SECTION_GAP_Y }} />

        <div
          style={{
            display: "flex",
            height: FOOTER_HEIGHT,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", color: INK_SECONDARY, fontSize: 12 }}>
            {people.length.toLocaleString()} contributors · {totalCommits.toLocaleString()}{" "}
            commits total
          </div>
          <div style={{ display: "flex", color: ACCENT, fontSize: 16, fontFamily: "Silkscreen" }}>
            blame
          </div>
        </div>
      </div>,
      width,
      height,
      CACHE_SECONDS,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return errorCard(message);
  }
}
