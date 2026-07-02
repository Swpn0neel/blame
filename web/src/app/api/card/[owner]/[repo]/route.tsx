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
//
// Everything below is authored in "logical" pixels, then multiplied by SCALE
// so the rasterized PNG carries SCALE× the pixel density. next/og renders at
// 1× with no retina multiplier, so without this the card looks soft on any
// HiDPI screen. 3× keeps it crisp; the card is small and cached for 24h, so
// the larger file and render time are a non-issue.
const SCALE = 3;

const MAX_TABLE_ROWS = 5;
const MAX_GRID_CONTRIBUTORS = 45;
const MAX_GRID_COLS = 9;

const PADDING = 28 * SCALE;
const HEADER_HEIGHT = 32 * SCALE;
const FOOTER_HEIGHT = 36 * SCALE;
const SECTION_GAP_Y = 18 * SCALE;
const SECTION_GAP_X = 28 * SCALE;

const TABLE_WIDTH = 300 * SCALE;
const TABLE_ROW_HEIGHT = 40 * SCALE;
const TABLE_AVATAR_SIZE = 24 * SCALE;

const GRID_AVATAR_SIZE = 28 * SCALE;
const GRID_GAP = 8 * SCALE;

const BORDER_WIDTH = SCALE; // 1 logical px at this density

const HEADER_FONT = 20 * SCALE;
const NAME_FONT = 14 * SCALE;
const COMMITS_FONT = 12 * SCALE;
const FOOTER_FONT = 12 * SCALE;
const WORDMARK_FONT = 16 * SCALE;
const NAME_GAP = 10 * SCALE;
const ERROR_FONT = 14 * SCALE;
const ERROR_HEIGHT = 120 * SCALE;

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
  const height = ERROR_HEIGHT;
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
      <div style={{ display: "flex", color: DANGER, fontSize: ERROR_FONT, textAlign: "center" }}>
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
          border: `${BORDER_WIDTH}px solid ${BORDER}`,
          alignItems: "center",
          justifyContent: "center",
          color: ACCENT,
          fontSize: Math.max(9 * SCALE, Math.round(size * 0.4)),
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
      style={{ borderRadius: "50%", border: `${BORDER_WIDTH}px solid ${BORDER}` }}
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
    const gridWidth = hasGrid ? gridCols * GRID_AVATAR_SIZE + (gridCols - 1) * GRID_GAP : 0;

    // Chunk the grid into explicit rows, each exactly TABLE_ROW_HEIGHT tall with
    // its avatars vertically centered. That gives the grid the same vertical
    // rhythm as the table, so every grid row lines up with the table row beside
    // it — a flex-wrap grid packs at avatar-height pitch and drifts out of line.
    const gridRowChunks: Contributor[][] = [];
    for (let i = 0; i < grid.length; i += MAX_GRID_COLS) {
      gridRowChunks.push(grid.slice(i, i + MAX_GRID_COLS));
    }
    const gridHeight = gridRowChunks.length * TABLE_ROW_HEIGHT;

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
          <div style={{ display: "flex", color: INK, fontSize: HEADER_FONT, fontWeight: 600 }}>
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
                  borderTop: i === 0 ? "none" : `${BORDER_WIDTH}px solid ${BORDER}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: NAME_GAP }}>
                  <AvatarCircle src={c.avatarUrl} size={TABLE_AVATAR_SIZE} name={c.name} />
                  <div
                    style={{ display: "flex", color: INK, fontSize: NAME_FONT, whiteSpace: "nowrap" }}
                  >
                    {c.name}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    color: ACCENT,
                    fontSize: COMMITS_FONT,
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.commits.toLocaleString()} commits
                </div>
              </div>
            ))}
          </div>

          {hasGrid && (
            <>
              <div style={{ display: "flex", width: SECTION_GAP_X }} />
              <div style={{ display: "flex", flexDirection: "column", width: gridWidth }}>
                {gridRowChunks.map((row, ri) => (
                  <div
                    key={ri}
                    style={{
                      display: "flex",
                      height: TABLE_ROW_HEIGHT,
                      alignItems: "center",
                      gap: GRID_GAP,
                    }}
                  >
                    {row.map((c) => (
                      <AvatarCircle
                        key={c.key}
                        src={c.avatarUrl}
                        size={GRID_AVATAR_SIZE}
                        name={c.name}
                      />
                    ))}
                  </div>
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
          <div
            style={{ display: "flex", color: INK_SECONDARY, fontSize: FOOTER_FONT, whiteSpace: "nowrap" }}
          >
            {people.length.toLocaleString()} contributors · {totalCommits.toLocaleString()}{" "}
            commits total
          </div>
          <div
            style={{ display: "flex", color: ACCENT, fontSize: WORDMARK_FONT, fontFamily: "Silkscreen" }}
          >
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
