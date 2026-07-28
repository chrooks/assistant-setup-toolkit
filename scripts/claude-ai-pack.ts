/**
 * CLI entry point for the claude.ai skill pack.
 * Packs the curated skills + preferences into artifacts/claude-ai/.
 */
import { runClaudeAiPack } from "../src/setup/claude-ai-pack.js";

runClaudeAiPack(process.cwd())
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error("claude.ai pack failed with an unexpected error:", err);
    process.exitCode = 1;
  });
