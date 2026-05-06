/**
 * Install Receipt read/write operations.
 *
 * Receipts are timestamped records of toolkit-owned files stored
 * inside each Assistant Home at .assistant-setup-toolkit/receipt.json.
 */

import type { InstallReceipt } from "./domain.js";

/**
 * Build an Install Receipt from a completed write.
 * Does not write to disk — the apply module handles that.
 */
export function buildInstallReceipt(
  params: Omit<InstallReceipt, "schemaVersion" | "toolkit" | "installedAt">,
): InstallReceipt {
  return {
    schemaVersion: 1,
    toolkit: "code-assistant-context",
    installedAt: new Date().toISOString(),
    ...params,
  };
}
