/**
 * Apply module — executes a WritePlan against the real filesystem.
 *
 * Creates backups before modifications, copies/overwrites payload files,
 * removes pruned files, and writes Install Receipts. Dry-run plans
 * are detected and produce no filesystem changes.
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { WritePlan } from "./write-plan.js";
import type { AssistantTargetId, ComponentKind, WriteBehavior } from "./domain.js";

// -- Types --

/** Options for receipt generation after apply. */
export interface ApplyReceiptOptions {
  readonly assistantTarget: AssistantTargetId;
  readonly mode: "default" | "custom";
  readonly components: readonly ComponentKind[];
  readonly writeBehavior: WriteBehavior;
}

/** Result of applying a write plan. */
export interface ApplyResult {
  readonly dryRun: boolean;
  readonly filesWritten: number;
  readonly filesSkipped: number;
  readonly filesRemoved: number;
  readonly errors: readonly ApplyError[];
}

/** An error encountered during apply for a specific file. */
export interface ApplyError {
  readonly relativePath: string;
  readonly action: string;
  readonly message: string;
}

// -- Helpers --

/** Back up a single file from the Assistant Home into the backup directory. */
async function backupFile(
  assistantHome: string,
  backupPath: string,
  relativePath: string,
): Promise<void> {
  const sourcePath = path.join(assistantHome, relativePath);
  const targetPath = path.join(backupPath, relativePath);

  try {
    await fs.access(sourcePath);
  } catch {
    // File doesn't exist in home — nothing to back up
    return;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

// -- Main apply function --

/**
 * Execute a WritePlan against the filesystem.
 *
 * For dry-run plans, returns immediately with zero changes.
 * For live plans:
 *   1. Creates the backup directory
 *   2. Backs up files that will be overwritten or removed
 *   3. Copies new files, overwrites conflicts, removes pruned files
 *   4. Writes an Install Receipt if receiptOptions provided
 */
export async function applyWritePlan(
  plan: WritePlan,
  receiptOptions?: ApplyReceiptOptions,
): Promise<ApplyResult> {
  // Dry-run — do nothing
  if (plan.dryRun) {
    return {
      dryRun: true,
      filesWritten: 0,
      filesSkipped: 0,
      filesRemoved: 0,
      errors: [],
    };
  }

  let filesWritten = 0;
  let filesSkipped = 0;
  let filesRemoved = 0;
  const errors: ApplyError[] = [];

  // Ensure backup directory exists
  if (plan.backupPath) {
    await fs.mkdir(plan.backupPath, { recursive: true });
  }

  // Process each planned action
  for (const action of plan.actions) {
    try {
      switch (action.action) {
        case "copy": {
          // Create parent directories and copy the file
          const targetPath = path.join(plan.assistantHome, action.relativePath);
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.copyFile(action.sourcePath!, targetPath);
          filesWritten++;
          break;
        }

        case "overwrite": {
          // Back up the existing file first, then overwrite
          if (plan.backupPath) {
            await backupFile(plan.assistantHome, plan.backupPath, action.relativePath);
          }
          const targetPath = path.join(plan.assistantHome, action.relativePath);
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.copyFile(action.sourcePath!, targetPath);
          filesWritten++;
          break;
        }

        case "remove": {
          // Back up before removing
          if (plan.backupPath) {
            await backupFile(plan.assistantHome, plan.backupPath, action.relativePath);
          }
          const targetPath = path.join(plan.assistantHome, action.relativePath);
          await fs.unlink(targetPath);
          filesRemoved++;
          break;
        }

        case "skip": {
          filesSkipped++;
          break;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        relativePath: action.relativePath,
        action: action.action,
        message,
      });
    }
  }

  // Write Install Receipt if requested and no errors
  if (receiptOptions && errors.length === 0) {
    const writtenFiles = plan.actions
      .filter((a) => a.action === "copy" || a.action === "overwrite")
      .map((a) => a.relativePath);

    const receipt = {
      schemaVersion: 1,
      toolkit: "code-assistant-context",
      installedAt: new Date().toISOString(),
      assistantTarget: receiptOptions.assistantTarget,
      assistantHome: plan.assistantHome,
      setupProfile: {
        mode: receiptOptions.mode,
        components: receiptOptions.components,
        writeBehavior: receiptOptions.writeBehavior,
      },
      files: writtenFiles,
    };

    const receiptPath = path.join(
      plan.assistantHome,
      ".assistant-setup-toolkit",
      "receipt.json",
    );
    await fs.mkdir(path.dirname(receiptPath), { recursive: true });
    await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n", "utf-8");
  }

  return {
    dryRun: false,
    filesWritten,
    filesSkipped,
    filesRemoved,
    errors,
  };
}
