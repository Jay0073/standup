import type { Commit, CommitTypeCounts, FileCounts } from "./group.ts";
import { countCommitTypes } from "./group.ts";

export interface RepoDigest {
  name: string;
  commitCount: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
  types: CommitTypeCounts;
  commits: Commit[];
  topFiles: { file: string; count: number }[];
}

export function buildRepoDigests(
  commits: Commit[],
  fileCounts: FileCounts,
): RepoDigest[] {
  const byRepo = new Map<string, Commit[]>();
  for (const commit of commits) {
    const list = byRepo.get(commit.repo);
    if (list) {
      list.push(commit);
    } else {
      byRepo.set(commit.repo, [commit]);
    }
  }

  const digests: RepoDigest[] = [];
  for (const [name, repoCommits] of [...byRepo.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    digests.push({
      name,
      commitCount: repoCommits.length,
      filesChanged: repoCommits.reduce((sum, c) => sum + c.filesChanged, 0),
      insertions: repoCommits.reduce((sum, c) => sum + c.insertions, 0),
      deletions: repoCommits.reduce((sum, c) => sum + c.deletions, 0),
      types: countCommitTypes(repoCommits),
      commits: repoCommits,
      topFiles: fileCounts.get(name) ?? [],
    });
  }

  return digests;
}

const TYPE_LABELS: Record<string, [string, string]> = {
  feat: ["feature", "features"],
  fix: ["fix", "fixes"],
  docs: ["docs", "docs"],
  refactor: ["refactor", "refactors"],
  perf: ["perf change", "perf changes"],
  test: ["test change", "test changes"],
  chore: ["chore", "chores"],
  build: ["build change", "build changes"],
  ci: ["CI change", "CI changes"],
  style: ["style change", "style changes"],
  revert: ["revert", "reverts"],
  merge: ["merge", "merges"],
  other: ["other commit", "other commits"],
};

export function describeTypes(types: CommitTypeCounts): string {
  const parts: string[] = [];
  for (const [type, count] of Object.entries(types)) {
    const labels = TYPE_LABELS[type] ?? ["commit", "commits"];
    parts.push(`${count} ${count === 1 ? labels[0] : labels[1]}`);
  }
  return parts.join(", ");
}

export function formatStatsLine(digest: RepoDigest): string {
  const parts = [
    `${digest.commitCount} ${digest.commitCount === 1 ? "commit" : "commits"}`,
    `${digest.filesChanged} ${digest.filesChanged === 1 ? "file" : "files"} changed`,
    `+${digest.insertions}`,
    `\u2212${digest.deletions}`,
  ];
  return parts.join(" \u00b7 ");
}
