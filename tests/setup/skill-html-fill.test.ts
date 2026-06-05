import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const tmp = mkdtempSync(path.join(os.tmpdir(), "skill-fill-"));

// A value crafted to break the inline <script>: it closes the script element and
// opens a comment. If the fill script does not neutralize it, the generated page dies.
const TORTURE = "</script><b>x</b> <!-- c -->";

function runFill(script: string, spec: unknown): string {
  const specPath = path.join(tmp, "spec.json");
  const outPath = path.join(tmp, "out.html");
  writeFileSync(specPath, JSON.stringify(spec));
  execFileSync("python3", [path.join(repoRoot, script), specPath, outPath]);
  return readFileSync(outPath, "utf-8");
}

describe("table build script", () => {
  const script = "canonical/skills/table/scripts/build-table.py";

  it("neutralizes </script> in injected data so the page cannot break", () => {
    const html = runFill(script, {
      title: "T",
      columns: [{ key: "n", label: "N", type: "string" }],
      data: [{ n: TORTURE }],
    });
    expect(html).not.toContain("/*__TABLE_DATA__*/"); // placeholder filled
    expect(html).not.toContain("</script><b>x</b>"); // raw script-close is gone
    expect(html).toContain("<\\/script><b>x</b>"); // escaped form present (same JSON string)
  });

  it("HTML-escapes the title (it lands in <title>/<h1>)", () => {
    const html = runFill(script, {
      title: "<img src=x onerror=alert(1)>",
      columns: [{ key: "n", label: "N", type: "string" }],
      data: [],
    });
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});

describe("diagram build script", () => {
  const script = "canonical/skills/diagram/scripts/build-diagram.py";

  it("neutralizes </script> in injected nodes and inlines the lib", () => {
    const html = runFill(script, {
      title: "D",
      kind: "flow",
      nodes: [{ id: "a", label: TORTURE, description: TORTURE }],
      edges: [],
    });
    expect(html).not.toContain("/*__DIAGRAM_NODES__*/"); // placeholder filled
    expect(html).not.toContain("/*__VIS_NETWORK_JS__*/"); // lib inlined
    expect(html).not.toContain("</script><b>x</b>"); // raw script-close is gone
    expect(html).toContain("<\\/script><b>x</b>"); // escaped form present
  });
});
