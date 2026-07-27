/**
 * Report which upstream Skills have moved since this repository last reconciled
 * with them.
 *
 * Reads the `upstream:` block from every Skill in `canonical/skills/`, asks
 * GitHub what changed in each recorded path since its recorded ref, and prints
 * the result. It reports and never writes — deciding whether an upstream change
 * is worth taking is a human's job, routed through `/toolkit check`.
 *
 * Exits zero even when drift is found. This is a report, not a gate; a non-zero
 * exit would eventually get wired into something that blocks a commit.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  buildDriftReports,
  readAllProvenance,
  renderDriftReport,
  type CommitFetcher,
} from "../src/setup/provenance.js";

const execFileAsync = promisify(execFile);

/** GitHub's commits API caps `per_page` at 100; more than that is not a drift report. */
const MAX_COMMITS = 100;

async function gh(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("gh", args, { maxBuffer: 32 * 1024 * 1024 });
  return stdout.trim();
}

/**
 * Every file path in a repository at HEAD.
 *
 * Fetched once per repository so a path that no longer exists can be told apart
 * from a path that simply has no new commits — the commits API returns an empty
 * list for both, which would otherwise silently read as "up to date".
 */
async function repoPaths(repo: string): Promise<Set<string>> {
  const out = await gh(["api", `repos/${repo}/git/trees/HEAD?recursive=1`, "--jq", ".tree[].path"]);
  return new Set(out.split("\n"));
}

/** The commit date of a ref, used as the lower bound for the commit query. */
async function refDate(repo: string, ref: string): Promise<string> {
  return gh(["api", `repos/${repo}/commits/${ref}`, "--jq", ".commit.committer.date"]);
}

function makeFetcher(): CommitFetcher {
  const trees = new Map<string, Promise<Set<string>>>();
  const dates = new Map<string, Promise<string>>();

  const treeFor = (repo: string) => {
    if (!trees.has(repo)) trees.set(repo, repoPaths(repo));
    return trees.get(repo)!;
  };

  const dateFor = (repo: string, ref: string) => {
    const key = `${repo}@${ref}`;
    if (!dates.has(key)) dates.set(key, refDate(repo, ref));
    return dates.get(key)!;
  };

  return async (repo, filePath, sinceRef) => {
    const paths = await treeFor(repo);
    if (!paths.has(filePath)) return null;

    const since = await dateFor(repo, sinceRef);
    const out = await gh([
      "api",
      `repos/${repo}/commits?path=${encodeURIComponent(filePath)}&since=${since}&per_page=${MAX_COMMITS}`,
      "--jq",
      '.[] | .sha + " " + (.commit.message | split("\n")[0])',
    ]);
    if (out === "") return [];

    return out
      .split("\n")
      // `since` is inclusive, so the reconciled commit itself comes back. Drop it.
      .filter((line) => !line.startsWith(sinceRef))
      .map((line) => `${line.slice(0, 7)}${line.slice(40)}`);
  };
}

async function main(): Promise<void> {
  const records = await readAllProvenance(process.cwd());
  if (records.length === 0) {
    console.log("No Skills declare an upstream: block.");
    return;
  }

  const reports = await buildDriftReports(records, makeFetcher());
  console.log(renderDriftReport(reports));
}

main().catch((err: unknown) => {
  console.error("check-upstream failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
