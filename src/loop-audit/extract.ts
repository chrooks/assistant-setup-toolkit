import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface HumanTurn {
  device: string;
  project: string;
  sessionId: string;
  timestamp: string;
  cwd: string;
  gitBranch: string;
  text: string;
}

export interface ExtractStats {
  filesScanned: number;
  filesInWindow: number;
  turnsKept: number;
  turnsDropped: number;
  perDevice: Record<string, number>;
  sessions: number;
}

export interface ParseResult {
  turns: HumanTurn[];
  /** user-type candidate lines (or malformed lines) that did not survive the filters */
  dropped: number;
}

interface TranscriptMeta {
  device: string;
  project: string;
}

export function parseTranscriptLines(
  lines: string[],
  meta: TranscriptMeta,
  since: Date,
): ParseResult {
  const turns: HumanTurn[] = [];
  let dropped = 0;

  for (const line of lines) {
    let record: any;
    try {
      record = JSON.parse(line);
    } catch {
      dropped += 1;
      continue;
    }
    if (record?.type !== "user") continue;
    if (record.isSidechain === true || record.isMeta === true) {
      dropped += 1;
      continue;
    }
    const ts = typeof record.timestamp === "string" ? Date.parse(record.timestamp) : NaN;
    if (!Number.isFinite(ts) || ts < since.getTime()) {
      dropped += 1;
      continue;
    }
    const content = record.message?.content;
    let raw: string;
    if (typeof content === "string") {
      raw = content;
    } else if (Array.isArray(content)) {
      raw = content
        .filter((item: any) => item?.type === "text" && typeof item.text === "string")
        .map((item: any) => item.text)
        .join("\n");
    } else {
      dropped += 1;
      continue;
    }
    const text = raw
      .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
      .replace(/<system-reminder>[\s\S]*$/, "")
      .trim();
    if (
      text.length === 0 ||
      /(^|\n)<command-[a-z-]+>/.test(text) ||
      text.startsWith("<local-command-") ||
      text.startsWith("This session is being continued from a previous conversation")
    ) {
      dropped += 1;
      continue;
    }
    turns.push({
      device: meta.device,
      project: meta.project,
      sessionId: typeof record.sessionId === "string" ? record.sessionId : "",
      timestamp: record.timestamp,
      cwd: typeof record.cwd === "string" ? record.cwd : "",
      gitBranch: typeof record.gitBranch === "string" ? record.gitBranch : "",
      text,
    });
  }

  return { turns, dropped };
}

function subdirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

export function extractArchive(
  archiveRoot: string,
  since: Date,
): { turns: HumanTurn[]; stats: ExtractStats } {
  const turns: HumanTurn[] = [];
  const stats: ExtractStats = {
    filesScanned: 0,
    filesInWindow: 0,
    turnsKept: 0,
    turnsDropped: 0,
    perDevice: {},
    sessions: 0,
  };
  const sessions = new Set<string>();

  for (const device of subdirs(archiveRoot)) {
    for (const project of subdirs(join(archiveRoot, device, "projects"))) {
      const projectDir = join(archiveRoot, device, "projects", project);
      let files: string[];
      try {
        files = readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
      } catch {
        continue;
      }
      for (const file of files) {
        const path = join(projectDir, file);
        stats.filesScanned += 1;
        // rsync -a preserves source mtimes, so mtime reflects when the session
        // last wrote — a cheap pre-filter before reading the file at all.
        // statSync can race a live rsync push (file replaced/gone mid-scan).
        const stat = statSync(path, { throwIfNoEntry: false });
        if (!stat || stat.mtime < since) continue;
        stats.filesInWindow += 1;
        let body: string;
        try {
          body = readFileSync(path, "utf8");
        } catch {
          continue; // same race: file replaced between stat and read
        }
        const lines = body.split("\n").filter((l) => l.trim().length > 0);
        const result = parseTranscriptLines(lines, { device, project }, since);
        stats.turnsDropped += result.dropped;
        for (const turn of result.turns) {
          turns.push(turn);
          stats.perDevice[device] = (stats.perDevice[device] ?? 0) + 1;
          sessions.add(`${device}/${turn.sessionId}`);
        }
      }
    }
  }

  stats.turnsKept = turns.length;
  stats.sessions = sessions.size;
  return { turns, stats };
}
