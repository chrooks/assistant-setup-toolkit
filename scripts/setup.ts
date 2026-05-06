/**
 * CLI entry point for the Setup Wizard.
 * Delegates to the orchestration module and sets the process exit code.
 */
import { runSetupWizard } from "../src/setup/index.js";

runSetupWizard(process.argv.slice(2), process.env)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error("Setup Wizard failed with an unexpected error:", err);
    process.exitCode = 1;
  });
