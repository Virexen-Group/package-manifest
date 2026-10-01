// Semantic versions (MAJOR.MINOR.PATCH, optional -prerelease) and the ranges packages use for
// compatibility and dependencies: exact ("1.2.3"), caret ("^1.2.0"), tilde ("~1.2.0"), comparisons
// (">=1.9.0", "<2.0.0"), x-ranges ("1.x", "*"), combined with spaces (AND) and "||" (OR).
// Dependency-free so every package and service can use the same rules.

export type Version = { major: number; minor: number; patch: number; prerelease: string[] };

const VERSION = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseVersion(value: string): Version | null {
  const match = VERSION.exec(value.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ? match[4].split(".") : [] };
}

export const isVersion = (value: string) => parseVersion(value) !== null;

export function compareVersions(a: string | Version, b: string | Version): number {
  const left = typeof a === "string" ? parseVersion(a) : a;
  const right = typeof b === "string" ? parseVersion(b) : b;
  if (!left || !right) throw new Error(`Invalid version: ${!left ? String(a) : String(b)}`);
  for (const key of ["major", "minor", "patch"] as const) if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  // A prerelease sorts before its release; identifiers compare numerically when numeric
  if (!left.prerelease.length || !right.prerelease.length) return left.prerelease.length === right.prerelease.length ? 0 : left.prerelease.length ? -1 : 1;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index++) {
    const x = left.prerelease[index];
    const y = right.prerelease[index];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xNumeric = /^\d+$/.test(x);
    const yNumeric = /^\d+$/.test(y);
    if (xNumeric && yNumeric) return Number(x) < Number(y) ? -1 : 1;
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

type Comparator = { operator: "<" | "<=" | ">" | ">=" | "="; version: Version };

const v = (major: number, minor: number, patch: number, prerelease: string[] = []): Version => ({ major, minor, patch, prerelease });

/** One space-separated set of conditions (all must hold) → comparators */
function comparators(part: string): Comparator[] | null {
  const result: Comparator[] = [];
  for (const token of part.trim().split(/\s+/).filter(Boolean)) {
    if (token === "*" || token === "x" || token === "X") continue;
    const operatorMatch = /^(<=|>=|<|>|=|\^|~)?(.*)$/.exec(token)!;
    const operator = operatorMatch[1] ?? "";
    const body = operatorMatch[2]!.replace(/^v/, "");
    const pieces = body.split(/[-+]/)[0]!.split(".");
    const wildcard = (piece: string | undefined) => piece === undefined || piece === "x" || piece === "X" || piece === "*";
    if (pieces.some((piece, index) => !wildcard(piece) && !/^\d+$/.test(piece)) || pieces.length > 3) return null;
    const [major, minor, patch] = pieces.map((piece) => (wildcard(piece) ? null : Number(piece)));
    const exact = parseVersion(body);
    if (major === null || major === undefined) {
      if (operator && operator !== "=" && operator !== ">=" && operator !== "<=") return null;
      continue;
    }
    if (operator === "^") {
      const low = exact ?? v(major, minor ?? 0, patch ?? 0);
      const high = major > 0 || minor === null || minor === undefined ? v(major + 1, 0, 0) : minor > 0 || patch === null || patch === undefined ? v(0, minor + 1, 0) : v(0, 0, patch + 1);
      result.push({ operator: ">=", version: low }, { operator: "<", version: v(high.major, high.minor, high.patch, ["0"]) });
    } else if (operator === "~" || (!operator && (minor === null || minor === undefined || patch === null || patch === undefined))) {
      const low = exact ?? v(major, minor ?? 0, patch ?? 0);
      const high = minor === null || minor === undefined ? v(major + 1, 0, 0) : v(major, minor + 1, 0);
      result.push({ operator: ">=", version: low }, { operator: "<", version: v(high.major, high.minor, high.patch, ["0"]) });
    } else {
      const version = exact ?? v(major, minor ?? 0, patch ?? 0);
      result.push({ operator: (operator || "=") as Comparator["operator"], version });
    }
  }
  return result;
}

/** Whether a range is well-formed */
export function isRange(range: string) {
  return range.trim() !== "" && range.split("||").every((part) => comparators(part) !== null);
}

/**
 * Whether `version` satisfies `range`. Prereleases only match a range that names a prerelease of
 * the same MAJOR.MINOR.PATCH (as npm does), so "^1.0.0" never picks up "1.1.0-beta.1".
 */
export function satisfies(version: string, range: string): boolean {
  const target = parseVersion(version);
  if (!target) return false;
  return range.split("||").some((part) => {
    const set = comparators(part);
    if (!set) return false;
    const holds = set.every(({ operator, version: bound }) => {
      const order = compareVersions(target, bound);
      return operator === "=" ? order === 0 : operator === ">" ? order > 0 : operator === ">=" ? order >= 0 : operator === "<" ? order < 0 : order <= 0;
    });
    if (!holds) return false;
    if (!target.prerelease.length) return true;
    return set.some(({ version: bound }) => bound.prerelease.length > 0 && bound.prerelease[0] !== "0" && bound.major === target.major && bound.minor === target.minor && bound.patch === target.patch);
  });
}

/** The highest version satisfying `range` (prereleases only if asked for, as above) */
export function maxSatisfying(versions: readonly string[], range: string): string | null {
  return [...versions].filter((version) => satisfies(version, range)).sort(compareVersions).pop() ?? null;
}
