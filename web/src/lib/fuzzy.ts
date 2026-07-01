export type FuzzyMatch = {
  score: number;
  indices: number[];
};

const SCORE_MATCH = 10;
const CONSECUTIVE_STEP_BONUS = 4;
const WORD_BOUNDARY_BONUS = 8;
const SEPARATOR_RE = /[\s._@-]/;

const NEG_INF = -Infinity;

/**
 * Subsequence fuzzy match: every character of `query` must appear in `text`,
 * in order, but not necessarily adjacent. Uses dynamic programming to find
 * the highest-scoring alignment overall (not just the first greedy one), so
 * a tight, word-boundary-aligned cluster of matched letters always outranks
 * a coincidental scatter of the same letters — even when the text contains
 * repeated letters far apart.
 *
 * Operates on Unicode code points (not UTF-16 code units) throughout, so the
 * returned indices line up with `Array.from(text)` for highlighting, even
 * for names containing surrogate-pair characters (e.g. emoji).
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const queryChars = Array.from(query.trim().toLowerCase());
  const n = queryChars.length;
  if (n === 0) return null;

  const textChars = Array.from(text.toLowerCase());
  const m = textChars.length;
  if (n > m) return null;

  const wordBonus = (j: number) =>
    j === 0 || SEPARATOR_RE.test(textChars[j - 1]) ? WORD_BOUNDARY_BONUS : 0;

  // H[i][j]: best score aligning queryChars[0..=i] with a match ending at textChars[j].
  // C[i][j]: consecutive run length ending at that match (for scoring the next extension).
  // P[i][j]: the previous row's column used to reach this cell (for backtracking), or -1.
  let prevH = new Float64Array(m).fill(NEG_INF);
  let prevC = new Int32Array(m);
  const parents: Int32Array[] = [];

  for (let i = 0; i < n; i++) {
    const curH = new Float64Array(m).fill(NEG_INF);
    const curC = new Int32Array(m);
    const curP = new Int32Array(m).fill(-1);

    // Running best of prevH[0..j-1] and the column that achieved it, for the
    // "start a new run here" option (gap of any size before this match).
    let bestPrev = NEG_INF;
    let bestPrevCol = -1;

    for (let j = 0; j < m; j++) {
      if (textChars[j] === queryChars[i]) {
        let best = NEG_INF;
        let bestRun = 1;
        let bestParent = -1;

        if (i === 0) {
          best = SCORE_MATCH + wordBonus(j);
          bestRun = 1;
        } else {
          // Option A: extend the run consecutively from the immediately preceding column.
          if (j > 0 && prevH[j - 1] !== NEG_INF) {
            const run = prevC[j - 1] + 1;
            const score = prevH[j - 1] + SCORE_MATCH + wordBonus(j) + (run - 1) * CONSECUTIVE_STEP_BONUS;
            if (score > best) {
              best = score;
              bestRun = run;
              bestParent = j - 1;
            }
          }
          // Option B: start a fresh run, jumping from the best earlier column (any gap).
          if (bestPrev !== NEG_INF) {
            const score = bestPrev + SCORE_MATCH + wordBonus(j);
            if (score > best) {
              best = score;
              bestRun = 1;
              bestParent = bestPrevCol;
            }
          }
        }

        curH[j] = best;
        curC[j] = bestRun;
        curP[j] = bestParent;
      }

      if (prevH[j] > bestPrev) {
        bestPrev = prevH[j];
        bestPrevCol = j;
      }
    }

    parents.push(curP);
    prevH = curH;
    prevC = curC;
  }

  let bestCol = -1;
  let bestScore = NEG_INF;
  for (let j = 0; j < m; j++) {
    if (prevH[j] > bestScore) {
      bestScore = prevH[j];
      bestCol = j;
    }
  }
  if (bestCol === -1) return null;

  const indices: number[] = new Array(n);
  let col = bestCol;
  for (let i = n - 1; i >= 0; i--) {
    indices[i] = col;
    col = parents[i][col];
  }

  // Light tiebreak so a tighter overall span ranks marginally above an
  // equally-scored but more spread-out alignment.
  const span = indices[indices.length - 1] - indices[0] + 1;
  const score = bestScore - (span - n) * 0.5;

  return { score, indices };
}
