/**
 * External Source pins (issue #38).
 *
 * Every fetched External Source carries a `commit:` pin in
 * manifests/install.yaml, so third-party code changes only through a reviewed
 * pin bump. This module compares pins with the upstream branch tips and
 * rewrites a pin in the manifest text without disturbing anything else.
 */

import { parseGitHubUrl } from "./external-fetcher.js";
import type { ExternalSource } from "./manifest.js";

/** Returns the SHA the ref points at upstream, or undefined when it cannot be read. */
export type ResolveTip = (repoUrl: string, ref: string) => Promise<string | undefined>;

export type PinRow =
  | { readonly id: string; readonly status: "current"; readonly pinned: string }
  | {
      readonly id: string;
      readonly status: "behind";
      readonly pinned: string;
      readonly tip: string;
      readonly compareUrl: string;
    }
  | { readonly id: string; readonly status: "unpinned"; readonly tip: string }
  | { readonly id: string; readonly status: "unreachable"; readonly pinned?: string };

type PinnableSource = Pick<ExternalSource, "id" | "url" | "kind" | "commit">;

/**
 * Compare each fetched source's pin with its upstream tip. MCP servers are
 * never cloned, so they carry no pin and are skipped.
 */
export async function comparePins(
  sources: readonly PinnableSource[],
  resolveTip: ResolveTip,
): Promise<PinRow[]> {
  const rows: PinRow[] = [];
  for (const source of sources) {
    if (source.kind === "mcp-server") continue;
    const { owner, repo, ref } = parseGitHubUrl(source.url);
    const tip = await resolveTip(`https://github.com/${owner}/${repo}.git`, ref ?? "HEAD");
    if (!tip) {
      rows.push({ id: source.id, status: "unreachable", pinned: source.commit });
    } else if (!source.commit) {
      rows.push({ id: source.id, status: "unpinned", tip });
    } else if (source.commit === tip) {
      rows.push({ id: source.id, status: "current", pinned: source.commit });
    } else {
      rows.push({
        id: source.id,
        status: "behind",
        pinned: source.commit,
        tip,
        compareUrl: `https://github.com/${owner}/${repo}/compare/${source.commit}...${tip}`,
      });
    }
  }
  return rows;
}

/**
 * Set one source's pin in the manifest text. Replaces an existing `commit:`
 * line, or adds one directly under the source's `url:` line. Everything else —
 * comments, order, formatting — stays byte-identical.
 */
export function setPin(manifestText: string, id: string, sha: string): string {
  const lines = manifestText.split("\n");
  const start = lines.findIndex((line) => new RegExp(`^\\s*- id: ${escape(id)}\\s*$`).test(line));
  if (start === -1) throw new Error(`No External Source with id "${id}" in the manifest.`);
  const next = lines.findIndex((line, i) => i > start && /^\s*- id: /.test(line));
  const end = next === -1 ? lines.length : next;

  const urlAt = lines.findIndex((line, i) => i > start && i < end && /^\s+url: /.test(line));
  if (urlAt === -1) throw new Error(`External Source "${id}" has no url: line.`);
  // Fields sit at the url: line's indent; anything deeper (a notes block
  // scalar, say) is text and must never be edited as the pin.
  const indent = lines[urlAt].match(/^\s+/)![0];
  const commitAt = lines.findIndex(
    (line, i) => i > start && i < end && line.startsWith(`${indent}commit: `),
  );
  if (commitAt !== -1) {
    lines[commitAt] = `${indent}commit: ${sha}`;
    return lines.join("\n");
  }
  lines.splice(urlAt + 1, 0, `${indent}commit: ${sha}`);
  return lines.join("\n");
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
