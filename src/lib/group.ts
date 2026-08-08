import { format } from "date-fns";

export interface Commit {
  repo: string;
  hash: string;
  date: Date;
  message: string;
  files: string[];
}

export type HourGroups = Map<string, Map<string, Commit[]>>;

export type FileCounts = Map<string, { file: string; count: number }[]>;

export function groupCommitsByHour(commits: Commit[]): HourGroups {
  const repos = new Map<string, Map<string, Commit[]>>();

  for (const commit of commits) {
    let hours = repos.get(commit.repo);
    if (!hours) {
      hours = new Map();
      repos.set(commit.repo, hours);
    }
    const label = hourLabel(commit.date);
    let bucket = hours.get(label);
    if (!bucket) {
      bucket = [];
      hours.set(label, bucket);
    }
    bucket.push(commit);
  }

  const sorted = new Map(
    [...repos.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  );
  for (const [repo, hours] of sorted) {
    const sortedHours = new Map(
      [...hours.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    );
    for (const bucket of sortedHours.values()) {
      bucket.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    sorted.set(repo, sortedHours);
  }

  return sorted;
}

export function countFilesByCommit(commits: Commit[]): FileCounts {
  const counts = new Map<string, Map<string, number>>();

  for (const commit of commits) {
    let repoCounts = counts.get(commit.repo);
    if (!repoCounts) {
      repoCounts = new Map();
      counts.set(commit.repo, repoCounts);
    }
    for (const file of new Set(commit.files)) {
      repoCounts.set(file, (repoCounts.get(file) ?? 0) + 1);
    }
  }

  const result: FileCounts = new Map();
  for (const [repo, repoCounts] of counts) {
    const entries = [...repoCounts.entries()].map(([file, count]) => ({
      file,
      count,
    }));
    entries.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));
    result.set(repo, entries);
  }

  return result;
}

function hourLabel(date: Date): string {
  return format(date, "HH:00");
}
