import { describe, expect, test } from "bun:test";
import type { Commit } from "../src/lib/group.ts";
import {
  buildRepoDigests,
  describeTypes,
  formatStatsLine,
} from "../src/lib/digest.ts";

function commit(overrides: Partial<Commit>): Commit {
  return {
    repo: "my-project",
    hash: "abc123",
    date: new Date("2026-08-07T09:00:00+02:00"),
    message: "feat: add search",
    files: ["src/a.ts"],
    filesChanged: 1,
    insertions: 10,
    deletions: 2,
    ...overrides,
  };
}

describe("buildRepoDigests", () => {
  test("aggregates stats and sorts repos by name", () => {
    const commits = [
      commit({ repo: "zeta", insertions: 5 }),
      commit({ repo: "alpha", insertions: 20, deletions: 4, filesChanged: 3 }),
      commit({ repo: "alpha", message: "fix(ui): typo", insertions: 1 }),
    ];

    const fileCounts = new Map([
      ["alpha", [{ file: "src/a.ts", count: 2 }]],
    ]);
    const digests = buildRepoDigests(commits, fileCounts);

    expect(digests.map((d) => d.name)).toEqual(["alpha", "zeta"]);
    expect(digests[0]).toMatchObject({
      commitCount: 2,
      filesChanged: 4,
      insertions: 21,
      deletions: 6,
      types: { feat: 1, fix: 1 },
    });
    expect(digests[0]!.topFiles).toEqual([{ file: "src/a.ts", count: 2 }]);
  });

  test("returns empty for no commits", () => {
    expect(buildRepoDigests([], new Map())).toEqual([]);
  });
});

describe("describeTypes", () => {
  test("formats counts with singular and plural labels", () => {
    expect(describeTypes({ feat: 1, fix: 2, docs: 1 })).toBe(
      "1 feature, 2 fixes, 1 docs",
    );
  });

  test("falls back for unknown types", () => {
    expect(describeTypes({ weird: 3 })).toBe("3 commits");
  });
});

describe("formatStatsLine", () => {
  test("renders stats with line-count symbols", () => {
    const digest = buildRepoDigests(
      [commit({ insertions: 15, deletions: 3 })],
      new Map(),
    )[0]!;
    expect(formatStatsLine(digest)).toBe(
      "1 commit \u00b7 1 file changed \u00b7 +15 \u00b7 \u22123",
    );
  });
});
