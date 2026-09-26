/**
 * Compare each External Source's pinned commit (manifests/install.yaml) with
 * its upstream branch tip, and bump pins on request.
 *
 *   npm run pins                      report: current / behind / unpinned
 *   npm run pins -- --update          pin every behind or unpinned source to its tip
 *   npm run pins -- --update <id...>  pin only the named sources
 *
 * Read the compare link before an update: a pin bump is the one moment
 * third-party code enters every machine.
 */
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { parseGitHubUrl } from "../src/setup/external-fetcher.js";
import { parseInstallationManifestYaml } from "../src/setup/manifest.js";
import { comparePins, setPin, type PinRow } from "../src/setup/pins.js";

const execFileAsync = promisify(execFile);
const manifestPath = path.join(process.cwd(), "manifests", "install.yaml");

async function resolveTip(repoUrl: string, ref: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["ls-remote", repoUrl, ref]);
    return stdout.split(/\s/)[0] || undefined;
  } catch {
    return undefined;
  }
}

/** Best effort: commits since the pin, and files changed under the source's subpath. */
async function changeSummary(url: string, pinned: string, tip: string): Promise<string> {
  const { owner, repo, subpath } = parseGitHubUrl(url);
  try {
    const { stdout } = await execFileAsync("gh", [
      "api",
      `repos/${owner}/${repo}/compare/${pinned}...${tip}`,
      "--jq",
      "[.ahead_by, ([.files[].filename] | join(\"\\n\"))] | @tsv",
    ]);
    const [ahead, files] = stdout.trim().split("\t");
    const relevant = (files ?? "")
      .split("\\n")
      .filter((f) => f && (!subpath || f.startsWith(`${subpath}/`)));
    return `${ahead} commit(s), ${relevant.length} file(s) changed${subpath ? ` under ${subpath}` : ""}`;
  } catch {
    return "change count unavailable (gh api failed)";
  }
}

function label(row: PinRow): string {
  switch (row.status) {
    case "current":
      return `current  ${row.pinned.slice(0, 12)}`;
    case "behind":
      return `behind   ${row.pinned.slice(0, 12)} → ${row.tip.slice(0, 12)}`;
    case "unpinned":
      return `unpinned tip ${row.tip.slice(0, 12)}`;
    case "unreachable":
      return "unreachable (git ls-remote failed)";
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const update = args.includes("--update");
  const only = args.filter((a) => !a.startsWith("--"));

  let text = await readFile(manifestPath, "utf-8");
  const manifest = parseInstallationManifestYaml(text, manifestPath);
  const rows = await comparePins(manifest.externalSources, resolveTip);
  const urlById = new Map(manifest.externalSources.map((s) => [s.id, s.url]));

  const width = Math.max(...rows.map((r) => r.id.length));
  for (const row of rows) {
    console.log(`${row.id.padEnd(width)}  ${label(row)}`);
    if (row.status === "behind") {
      console.log(`${" ".repeat(width)}  ${await changeSummary(urlById.get(row.id)!, row.pinned, row.tip)}`);
      console.log(`${" ".repeat(width)}  ${row.compareUrl}`);
    }
  }

  if (!update) {
    const stale = rows.filter((r) => r.status === "behind" || r.status === "unpinned").length;
    console.log(stale === 0 ? "\nAll pins current." : `\n${stale} source(s) can move. Review, then: npm run pins -- --update [id...]`);
    return;
  }

  let changed = 0;
  for (const row of rows) {
    if (row.status !== "behind" && row.status !== "unpinned") continue;
    if (only.length > 0 && !only.includes(row.id)) continue;
    text = setPin(text, row.id, row.tip);
    changed += 1;
  }
  const unknown = only.filter((id) => !rows.some((r) => r.id === id));
  if (unknown.length > 0) {
    console.error(`Unknown or unfetched source id(s): ${unknown.join(", ")}`);
    process.exitCode = 1;
  }
  // Re-parse before writing: a malformed edit must never reach the manifest.
  parseInstallationManifestYaml(text, manifestPath);
  await writeFile(manifestPath, text, "utf-8");
  console.log(`\nUpdated ${changed} pin(s) in manifests/install.yaml.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
