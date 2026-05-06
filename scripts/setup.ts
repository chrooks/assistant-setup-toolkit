/**
 * CLI entry point for the Setup Wizard.
 * Delegates to the orchestration module and sets the process exit code.
 */
async function main(): Promise<number> {
  // Placeholder — orchestration module added in Milestone 4
  console.log("Setup Wizard not yet implemented.");
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    console.error("Setup Wizard failed with an unexpected error:", err);
    process.exitCode = 1;
  });
