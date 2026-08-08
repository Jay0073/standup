import { describe, expect, test } from "bun:test";
import {
  countFilesByCommit,
  groupCommitsByHour,
  type Commit,
} from "../src/lib/group.ts";

function commit(
  repo: string,
  date: Date,
  message: string,
  files: string[] = [],
): Commit {
  return { repo, hash: "a".repeat(40), date, message, files };
}

describe("groupCommitsByHour", () => {
  test("buckets commits into hours and orders by time", () => {
    const groups = groupCommitsByHour([
      commit("alpha", new Date(2026, 7, 7, 9, 45), "second"),
      commit("alpha", new Date(2026, 7, 7, 9, 15), "first"),
      commit("alpha", new Date(2026, 7, 7, 10, 5), "next hour"),
    ]);

    const hours = groups.get("alpha")!;
    expect([...hours.keys()]).toEqual(["09:00", "10:00"]);
    expect(hours.get("09:00")!.map((c) => c.message)).toEqual(["first", "second"]);
    expect(hours.get("10:00")!.map((c) => c.message)).toEqual(["next hour"]);
  });

  test("groups commits from different repos separately", () => {
    const groups = groupCommitsByHour([
      commit("zeta", new Date(2026, 7, 7, 9, 0), "z"),
      commit("alpha", new Date(2026, 7, 7, 9, 0), "a"),
    ]);

    expect([...groups.keys()]).toEqual(["alpha", "zeta"]);
    expect(groups.get("alpha")!.get("09:00")).toHaveLength(1);
    expect(groups.get("zeta")!.get("09:00")).toHaveLength(1);
  });

  test("hour label is zero-padded", () => {
    const groups = groupCommitsByHour([
      commit("alpha", new Date(2026, 7, 7, 3, 0), "early"),
    ]);
    expect([...groups.get("alpha")!.keys()]).toEqual(["03:00"]);
  });

  test("returns an empty map for no commits", () => {
    expect(groupCommitsByHour([]).size).toBe(0);
  });
});

describe("countFilesByCommit", () => {
  test("counts commits per file and sorts by count then name", () => {
    const counts = countFilesByCommit([
      commit("alpha", new Date(2026, 7, 7, 9, 0), "1", ["src/a.ts", "src/b.ts"]),
      commit("alpha", new Date(2026, 7, 7, 10, 0), "2", ["src/a.ts"]),
      commit("alpha", new Date(2026, 7, 7, 11, 0), "3", ["src/b.ts"]),
      commit("alpha", new Date(2026, 7, 7, 12, 0), "4", ["src/c.ts"]),
    ]);

    expect(counts.get("alpha")).toEqual([
      { file: "src/a.ts", count: 2 },
      { file: "src/b.ts", count: 2 },
      { file: "src/c.ts", count: 1 },
    ]);
  });

  test("dedupes a file listed twice in one commit", () => {
    const counts = countFilesByCommit([
      commit("alpha", new Date(2026, 7, 7, 9, 0), "1", ["src/a.ts", "src/a.ts"]),
    ]);
    expect(counts.get("alpha")).toEqual([{ file: "src/a.ts", count: 1 }]);
  });

  test("keeps per-repo counts separate", () => {
    const counts = countFilesByCommit([
      commit("alpha", new Date(2026, 7, 7, 9, 0), "1", ["src/a.ts"]),
      commit("beta", new Date(2026, 7, 7, 9, 0), "1", ["src/a.ts"]),
    ]);
    expect(counts.get("alpha")).toEqual([{ file: "src/a.ts", count: 1 }]);
    expect(counts.get("beta")).toEqual([{ file: "src/a.ts", count: 1 }]);
  });

  test("returns an empty map for no commits", () => {
    expect(countFilesByCommit([]).size).toBe(0);
  });
});
