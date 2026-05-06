/**
 * Path resolution for Assistant Homes, Install Receipts, and backups.
 *
 * Accepts an optional fake home directory for testing so that
 * tests never touch real user directories. Uses Node path APIs
 * for cross-platform compatibility.
 */

import path from "node:path";
import os from "node:os";
import type { AssistantHomeId } from "./domain.js";

// -- Mapping from home IDs to directory names --

const HOME_DIR_MAP: Record<AssistantHomeId, string> = {
  "claude-home": ".claude",
  "codex-home": ".codex",
  "agents-home": ".agents",
};

/** Toolkit metadata directory name inside each Assistant Home. */
const TOOLKIT_META_DIR = ".assistant-setup-toolkit";

/**
 * Resolve the absolute path for an Assistant Home.
 * Uses fakeHome when provided (for tests), otherwise os.homedir().
 */
export function resolveAssistantHomePath(
  homeId: AssistantHomeId,
  fakeHome?: string,
): string {
  const base = fakeHome ?? os.homedir();
  return path.join(base, HOME_DIR_MAP[homeId]);
}

/**
 * Resolve the Install Receipt path for an Assistant Home.
 * Returns <assistantHome>/.assistant-setup-toolkit/receipt.json.
 */
export function resolveReceiptPath(assistantHome: string): string {
  return path.join(assistantHome, TOOLKIT_META_DIR, "receipt.json");
}

/**
 * Resolve a timestamped backup directory path for an Assistant Home.
 * Returns <assistantHome>/.assistant-setup-toolkit/backups/<ISO-timestamp>.
 * Each non-dry-run write creates a new timestamped backup.
 */
export function resolveBackupPath(assistantHome: string): string {
  // Replace colons with dashes for filesystem-safe timestamp
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  return path.join(assistantHome, TOOLKIT_META_DIR, "backups", timestamp);
}
