import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Commit } from "./group.ts";

export interface Repo {
  path: string;
  name: string;
}

export class GitError extends Error {
  constructor(
    public readonly repo: Repo,
    message: string,
  ) {
    super(message);
    this.name = "GitError";
  }
}

export async function discoverRepos(cwd: string): Promise<Repo[]> {
  const found: Repo[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".git") {
        found.push({ path: dir, name: basename(dir) });
        continue;
      }
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name));
      }
    }
  }

  await walk(cwd);
  found.sort((a, b) => a.name.localeCompare(b.name));
  return found;
}

export function fetchLog(repo: Repo, since: Date, until: Date): Commit[] {
  const result = Bun.spawnSync(
    [
      "git",
      "log",
      `--since=${since.toISOString()}`,
      `--until=${until.toISOString()}`,
      "--format=%x00%H|%ad|%s",
      "--date=iso-strict",
      "--numstat",
    ],
    { cwd: repo.path, stdout: "pipe", stderr: "pipe" },
  );

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim();
    throw new GitError(repo, stderr || `git log failed with exit code ${result.exitCode}`);
  }

  return parseLogOutput(result.stdout.toString(), repo.name);
}

const NUMSTAT_RE = /^(\d+|-)\t(\d+|-)\t(.+)$/;

export function parseLogOutput(stdout: string, repo: string): Commit[] {
  const commits: Commit[] = [];
  const text = stdout.replace(/\r/g, "");

  for (const block of text.split("\u0000")) {
    const lines = block.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      continue;
    }
    const parts = lines[0]!.split("|");
    if (parts.length < 3) {
      continue;
    }
    const date = new Date(parts[1]!);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const files: string[] = [];
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;

    for (const line of lines.slice(1)) {
      const match = NUMSTAT_RE.exec(line);
      if (!match) {
        continue;
      }
      files.push(match[3]!);
      filesChanged += 1;
      const added = Number(match[1]);
      const removed = Number(match[2]);
      if (!Number.isNaN(added)) {
        insertions += added;
      }
      if (!Number.isNaN(removed)) {
        deletions += removed;
      }
    }

    commits.push({
      repo,
      hash: parts[0]!,
      date,
      message: parts[2]!,
      files,
      filesChanged,
      insertions,
      deletions,
    });
  }

  return commits;
}
