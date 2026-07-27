/**
 * Upstream provenance and drift detection.
 *
 * Some Skills in `canonical/skills/` were copied from, or wrap, Skills that
 * live in other people's public repositories. Each of those declares an
 * `upstream:` block in its own `SKILL.md` frontmatter recording where it came
 * from and which upstream commit it was last reconciled against.
 *
 * Drift is `upstream at the recorded ref` vs `upstream at its current tip` —
 * never local vs upstream. A `rewrite` differs from upstream permanently, and a
 * `wrapper` has no local copy of the upstream file at all, so a local-vs-upstream
 * comparison is noise for one and impossible for the other. Asking what the
 * *other project* changed since we last looked works identically for all four.
 *
 * Everything here is pure: `buildDriftReports` takes the network as a parameter
 * so the whole module is testable without one.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import { discoverSkillDirs } from "./index.js";

/** How a local Skill relates to the upstream file it was taken from. */
export const RELATIONSHIPS = ["verbatim", "near-copy", "rewrite", "wrapper"] as const;

export type SkillRelationship = (typeof RELATIONSHIPS)[number];

/** What one Skill's `upstream:` frontmatter block declares. */
export interface SkillProvenance {
  readonly skill: string;
  readonly repo: string;
  readonly path: string;
  readonly ref: string;
  readonly relationship: SkillRelationship;
}

const FRONTMATTER_DELIMITER = "---";

/** What a reader should do when a given relationship reports drift. */
const GUIDANCE: Record<SkillRelationship, string> = {
  verbatim: "re-copy the upstream file; ADR-0001 requires it stay byte-identical",
  "near-copy": "port the change by hand, preserving local edits",
  rewrite: "review for interest only; the local file is the real implementation",
  wrapper: "check whether the wrapped Skill's contract moved under the local overrides",
};

function frontmatterLines(skillMarkdown: string): string[] | null {
  const lines = skillMarkdown.split("\n");
  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) return null;

  const close = lines.findIndex((line, i) => i > 0 && line.trim() === FRONTMATTER_DELIMITER);
  if (close === -1) return null;

  return lines.slice(1, close);
}

/**
 * Slice the `upstream:` block out of the frontmatter, dedented.
 *
 * Only this block is parsed as YAML. Parsing the whole frontmatter would be
 * simpler but wrong: several Skills carry an unquoted `description:` holding a
 * colon, which is not valid YAML, and a broken description on an unrelated
 * Skill must not take the drift check down with it.
 */
function upstreamBlock(skillName: string, lines: string[]): string | null {
  const start = lines.findIndex((line) => /^upstream:/.test(line));
  if (start === -1) return null;

  const inline = lines[start].slice("upstream:".length).trim();
  if (inline !== "") {
    throw new Error(`Skill "${skillName}": "upstream" must be a block of key/value pairs.`);
  }

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") continue;
    if (!/^\s/.test(line)) break;
    body.push(line.replace(/^\s{2}/, ""));
  }

  if (body.length === 0) {
    throw new Error(`Skill "${skillName}": "upstream" block is empty.`);
  }

  return body.join("\n");
}

/**
 * Read one Skill's `upstream:` block.
 *
 * Returns `null` when the Skill declares no provenance — most don't, and that is
 * not an error. Throws when a block is present but malformed: a silently dropped
 * record is exactly the failure this module exists to prevent, so validate at
 * this boundary and fail loudly.
 */
export function parseProvenance(
  skillName: string,
  skillMarkdown: string,
): SkillProvenance | null {
  const lines = frontmatterLines(skillMarkdown);
  if (lines === null) return null;

  const block = upstreamBlock(skillName, lines);
  if (block === null) return null;

  let parsed: unknown;
  try {
    parsed = parseYaml(block);
  } catch (error) {
    throw new Error(
      `Skill "${skillName}": the upstream block is not valid YAML — ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Skill "${skillName}": "upstream" must be a block of key/value pairs.`);
  }

  const fields = parsed as Record<string, unknown>;
  const read = (key: "repo" | "path" | "ref"): string => {
    const value = fields[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Skill "${skillName}": upstream.${key} is missing or empty.`);
    }
    return value;
  };

  const relationship = fields.relationship;
  if (typeof relationship !== "string" || !isRelationship(relationship)) {
    throw new Error(
      `Skill "${skillName}": upstream.relationship is ${JSON.stringify(relationship)}, ` +
        `expected one of ${RELATIONSHIPS.join(", ")}.`,
    );
  }

  return {
    skill: skillName,
    repo: read("repo"),
    path: read("path"),
    ref: read("ref"),
    relationship,
  };
}

function isRelationship(value: string): value is SkillRelationship {
  return (RELATIONSHIPS as readonly string[]).includes(value);
}

/** Collect the `upstream:` block from every Skill in the canonical tree. */
export async function readAllProvenance(repoRoot: string): Promise<SkillProvenance[]> {
  const skillDirs = await discoverSkillDirs(repoRoot);
  const records: SkillProvenance[] = [];

  for (const skill of skillDirs) {
    if (!skill.files.includes("SKILL.md")) continue;

    const markdown = await fs.readFile(path.join(skill.sourceDir, "SKILL.md"), "utf8");
    // Machine-scoped skills are discovered as `machines/<machine>/<skill>`;
    // report the bare skill name, which is what a reader would search for.
    const name = skill.name.split("/").pop() ?? skill.name;
    const provenance = parseProvenance(name, markdown);
    if (provenance !== null) records.push(provenance);
  }

  return records.sort((a, b) => a.skill.localeCompare(b.skill));
}

/** What the check found for one Skill. */
export interface DriftReport {
  readonly skill: string;
  readonly relationship: SkillRelationship;
  readonly status:
    | { readonly kind: "current" }
    | { readonly kind: "moved"; readonly commits: readonly string[] }
    | { readonly kind: "path-missing" };
}

/**
 * Answers "which commits touched this path in this repository after this ref".
 * Returns one-line commit summaries, an empty array when nothing changed, or
 * `null` when the path does not exist upstream any more.
 */
export type CommitFetcher = (
  repo: string,
  filePath: string,
  sinceRef: string,
) => Promise<readonly string[] | null>;

/**
 * Turn provenance records into drift reports.
 *
 * The fetcher is a parameter, not an import: that is the Seam this module is
 * tested at. Do not reach for the network from in here.
 */
export async function buildDriftReports(
  records: readonly SkillProvenance[],
  fetchCommits: CommitFetcher,
): Promise<DriftReport[]> {
  const reports: DriftReport[] = [];

  for (const record of records) {
    const commits = await fetchCommits(record.repo, record.path, record.ref);
    const status: DriftReport["status"] =
      commits === null
        ? { kind: "path-missing" }
        : commits.length === 0
          ? { kind: "current" }
          : { kind: "moved", commits };

    reports.push({ skill: record.skill, relationship: record.relationship, status });
  }

  return reports;
}

/**
 * Render the report a human reads. Groups by status so the cases that need a
 * decision are not buried under the ones that don't.
 */
export function renderDriftReport(reports: readonly DriftReport[]): string {
  const missing = reports.filter((r) => r.status.kind === "path-missing");
  const moved = reports.filter((r) => r.status.kind === "moved");
  const current = reports.filter((r) => r.status.kind === "current");

  const out: string[] = ["Upstream drift report", ""];

  if (missing.length > 0) {
    out.push("PATH MISSING UPSTREAM — the recorded path is gone.");
    out.push("Re-point the `upstream.path` field by hand, or retire the record.");
    out.push("");
    for (const report of missing) {
      out.push(`  ${report.skill} (${report.relationship})`);
    }
    out.push("");
  }

  if (moved.length > 0) {
    out.push("MOVED — upstream changed since the recorded ref.");
    out.push("");
    for (const report of moved) {
      if (report.status.kind !== "moved") continue;
      out.push(`  ${report.skill} (${report.relationship}) — ${GUIDANCE[report.relationship]}`);
      for (const commit of report.status.commits) {
        out.push(`      ${commit}`);
      }
      out.push("");
    }
  }

  const total = reports.length;
  if (moved.length === 0 && missing.length === 0) {
    out.push(`All ${total} tracked Skills are up to date.`);
  } else {
    out.push(`${current.length} of ${total} tracked Skills up to date.`);
  }

  return out.join("\n");
}

export { GUIDANCE as DRIFT_GUIDANCE };
