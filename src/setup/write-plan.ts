/**
 * Write planner for the Setup Wizard.
 *
 * Given payload files, current filesystem state, previous receipts,
 * and write behavior, produces a WritePlan without touching the filesystem.
 * The plan describes what will be copied, overwritten, skipped, or removed.
 */

import type {
  PayloadFile,
  InstallReceipt,
  WriteBehavior,
} from "./domain.js";
import { resolveBackupPath } from "./paths.js";

// -- Types --

/** What action to take for a single file. */
type WriteAction = "copy" | "overwrite" | "skip" | "remove";

/** A planned action for a single file in the Assistant Home. */
export interface PlannedAction {
  readonly relativePath: string;
  readonly action: WriteAction;
  /** Source path for copy/overwrite actions, null for skip/remove. */
  readonly sourcePath: string | null;
}

/** The complete write plan for one Assistant Home. */
export interface WritePlan {
  readonly assistantHome: string;
  readonly writeBehavior: WriteBehavior;
  readonly dryRun: boolean;
  /** Timestamped backup directory path, or null for dry-run. */
  readonly backupPath: string | null;
  readonly actions: readonly PlannedAction[];
  readonly warnings: readonly string[];
}

/** Input for planning writes to an Assistant Home. */
export interface PlanWritesInput {
  readonly assistantHome: string;
  readonly payloadFiles: readonly PayloadFile[];
  /** Relative paths of files that already exist in the Assistant Home. */
  readonly existingFiles: readonly string[];
  /** Previous Install Receipt, or null if none exists. */
  readonly previousReceipt: InstallReceipt | null;
  readonly writeBehavior: WriteBehavior;
  readonly dryRun: boolean;
}

// -- Write planning --

/**
 * Plan filesystem writes for one Assistant Home without touching the filesystem.
 *
 * - Safe Merge: copy missing files, skip existing conflicts
 * - Overwrite: replace existing conflicts with payload files
 * - Prune: overwrite present files + remove stale receipt-owned files
 *   absent from new payload. Falls back to overwrite if no receipt exists.
 */
export function planWrites(input: PlanWritesInput): WritePlan {
  const {
    assistantHome,
    payloadFiles,
    existingFiles,
    previousReceipt,
    writeBehavior,
    dryRun,
  } = input;

  const existingSet = new Set(existingFiles);
  const actions: PlannedAction[] = [];
  const warnings: string[] = [];

  // Determine effective behavior — prune falls back to overwrite without receipt
  let effectiveBehavior = writeBehavior;
  if (writeBehavior === "prune" && !previousReceipt) {
    warnings.push(
      "No previous Install Receipt found. Cannot prune — falling back to overwrite behavior.",
    );
    effectiveBehavior = "overwrite";
  }

  // Track which payload relative paths we're installing (for prune diff)
  const payloadPaths = new Set(payloadFiles.map((f) => f.relativePath));

  // Plan actions for each payload file
  for (const file of payloadFiles) {
    const exists = existingSet.has(file.relativePath);

    if (!exists) {
      // File doesn't exist in home — always copy
      actions.push({
        relativePath: file.relativePath,
        action: "copy",
        sourcePath: file.sourcePath,
      });
    } else {
      // File exists — action depends on write behavior
      switch (effectiveBehavior) {
        case "safe-merge":
          // Skip existing files to avoid overwriting user changes
          actions.push({
            relativePath: file.relativePath,
            action: "skip",
            sourcePath: null,
          });
          break;

        case "overwrite":
        case "prune":
          // Replace existing file with payload version
          actions.push({
            relativePath: file.relativePath,
            action: "overwrite",
            sourcePath: file.sourcePath,
          });
          break;
      }
    }
  }

  // Prune: remove receipt-owned files absent from new payload
  if (effectiveBehavior === "prune" && previousReceipt) {
    for (const receiptFile of previousReceipt.files) {
      if (!payloadPaths.has(receiptFile) && existingSet.has(receiptFile)) {
        actions.push({
          relativePath: receiptFile,
          action: "remove",
          sourcePath: null,
        });
      }
    }
  }

  // Plan backup for non-dry-run writes
  const backupPath = dryRun ? null : resolveBackupPath(assistantHome);

  return {
    assistantHome,
    writeBehavior,
    dryRun,
    backupPath,
    actions,
    warnings,
  };
}
