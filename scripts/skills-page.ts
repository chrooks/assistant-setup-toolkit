// `npm run skills` — build the skills repertoire page for this machine, print
// its path, and open it when the session is local.
//
//   npm run skills [-- --out <file>] [-- --claude-home <dir>] [-- --skill-map <file>]
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { collectRepertoire, loadSkillMap, type Repertoire } from "../src/repertoire/collect.js";

const toolkitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pageDir = path.join(toolkitRoot, "src", "repertoire");

/** One self-contained HTML file: template styles, then search.js + client.js in one module, then the data. */
export function renderPage(rep: Repertoire): string {
  const read = (file: string) => readFileSync(path.join(pageDir, file), "utf8");
  const script = `<script type="module">\n${read("search.js")}\n${read("client.js")}</script>`;
  // Skill text is third-party and some contains "</script": escaping every "<"
  // keeps it from ever closing the data element.
  const json = JSON.stringify(rep).replace(/</g, "\\u003c");
  const data = `<script type="application/json" id="repertoire-data">${json}</script>`;
  // Function replacers: a "$&" inside skill text must not be read as a pattern.
  return read("page.html")
    .replace("<!-- repertoire:script -->", () => script)
    .replace("<!-- repertoire:data -->", () => data);
}

function openInBrowser(file: string): void {
  const [command, args] =
    process.platform === "darwin" ? ["open", [file]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", file]]
    : ["xdg-open", [file]];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", (error) => console.error(`Could not open the page: ${error.message}`));
  child.unref();
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      out: { type: "string" },
      "claude-home": { type: "string" },
      "skill-map": { type: "string" },
    },
  });
  const out = path.resolve(values.out ?? path.join(os.homedir(), ".cache", "repertoire", "index.html"));
  const claudeHome = path.resolve(values["claude-home"] ?? path.join(os.homedir(), ".claude"));

  const skillMap = loadSkillMap(path.resolve(values["skill-map"] ?? path.join(toolkitRoot, "manifests", "skill-map.yaml")));

  const rep = await collectRepertoire({ claudeHome, toolkitRoot, skillMap, machine: os.hostname(), now: new Date() });
  for (const skill of rep.unreadable) {
    console.error(`Couldn't read ${skill.name} (${skill.path}): ${skill.error.split("\n")[0]}`);
  }
  const uncategorized = rep.skills.filter((s) => s.uncategorized).map((s) => s.name);
  if (uncategorized.length) {
    console.error(`Uncategorized (add to manifests/skill-map.yaml): ${uncategorized.join(", ")}`);
  }

  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderPage(rep));
  console.log(out);

  if (process.env.SSH_CONNECTION || process.env.SSH_CLIENT) {
    console.log("Remote session — use /repertoire for a link.");
  } else {
    openInBrowser(out);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
