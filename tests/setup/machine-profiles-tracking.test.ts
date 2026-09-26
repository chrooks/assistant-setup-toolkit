import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Machine profiles describe real boxes (ADR-0003). Their skills are local-only by
// default; .gitignore holds the one allowlist of machine classes that are tracked,
// as `!canonical/machines/<class>/skills/*` lines. A `git add -f` past the ignore
// rule fails here instead of reaching the remote.

const root = process.cwd();
const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

function isIgnored(file: string): boolean {
  try {
    git("check-ignore", "-q", "--no-index", file);
    return true;
  } catch {
    return false;
  }
}

function trackedMachineClasses(): string[] {
  const gitignore = readFileSync(path.join(root, ".gitignore"), "utf8");
  return [...gitignore.matchAll(/^!canonical\/machines\/([^/*]+)\/skills\/\*$/gm)].map((m) => m[1]);
}

describe("machine profile tracking", () => {
  it("ignores a new machine class's skills without editing .gitignore", () => {
    expect(isIgnored("canonical/machines/new-client-box/skills/demo/SKILL.md")).toBe(true);
  });

  it("ignores every machine's rules file, tracked class or not", () => {
    expect(isIgnored("canonical/machines/new-client-box/rules.md")).toBe(true);
    for (const cls of trackedMachineClasses()) {
      expect(isIgnored(`canonical/machines/${cls}/rules.md`)).toBe(true);
    }
  });

  it("tracks nothing under canonical/machines outside the allowlist", () => {
    const allowed = trackedMachineClasses();
    const outside = git("ls-files", "canonical/machines")
      .split("\n")
      .filter(Boolean)
      .filter((file) => {
        if (file === "canonical/machines/TEMPLATE.md") return false;
        if (/^canonical\/machines\/[^/]+\/skills\/\.gitkeep$/.test(file)) return false;
        const match = /^canonical\/machines\/([^/]+)\/skills\//.exec(file);
        return !(match && allowed.includes(match[1]));
      });
    expect(outside).toEqual([]);
  });
});
