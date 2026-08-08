import { describe, expect, test } from "bun:test";
import type { Commit } from "../src/lib/group.ts";
import { buildPrompt, parseNarratives, stripThinkBlocks } from "../src/lib/ai.ts";
import { buildRepoDigests } from "../src/lib/digest.ts";

function commit(overrides: Partial<Commit>): Commit {
  return {
    repo: "my-project",
    hash: "abc1234567890",
    date: new Date("2026-08-07T09:00:00+02:00"),
    message: "feat: add search",
    files: ["src/a.ts"],
    filesChanged: 1,
    insertions: 10,
    deletions: 2,
    ...overrides,
  };
}

describe("buildPrompt", () => {
  test("includes per-repo stats, types, and commit messages", () => {
    const digests = buildRepoDigests(
      [commit({ message: "feat: add search" }), commit({ message: "fix: typo" })],
      new Map(),
    );

    const prompt = buildPrompt(digests);

    expect(prompt).toContain("Repo: my-project");
    expect(prompt).toContain("2 commits, 2 files changed, +20 \u22124 lines");
    expect(prompt).toContain("feat 1, fix 1");
    expect(prompt).toContain("- abc1234 feat: add search");
  });

  test("truncates long commit messages", () => {
    const long = "x".repeat(300);
    const digests = buildRepoDigests([commit({ message: long })], new Map());
    const prompt = buildPrompt(digests);
    expect(prompt).toContain(`${"x".repeat(120)}\u2026`);
  });

  test("caps the commit list per repo", () => {
    const many = Array.from({ length: 70 }, (_, i) =>
      commit({ hash: `h${String(i).padStart(3, "0")}`, message: `feat: item ${i}` }),
    );
    const digests = buildRepoDigests(many, new Map());
    const prompt = buildPrompt(digests);
    const lines = prompt
      .split("\n")
      .filter((l) => l.startsWith("- "));
    expect(lines).toHaveLength(30);
  });

  test("includes day totals", () => {
    const digests = buildRepoDigests(
      [commit({ insertions: 15, deletions: 3 })],
      new Map(),
    );
    const prompt = buildPrompt(digests);
    expect(prompt).toContain("DAY TOTALS:");
    expect(prompt).toContain("1 commits across 1 repos, 1 files changed, +15 \u22123 lines");
  });
});

describe("parseNarratives", () => {
  test("splits repo narratives and the overall summary", () => {
    const digests = buildRepoDigests(
      [commit({}), commit({ message: "fix: typo" })],
      new Map(),
    );
    const content = [
      "my-project: I shipped the search feature and fixed a typo along the way.",
      "OVERALL: A small day focused on the search work.",
      "junk line without a colon prefix rule",
    ].join("\n");

    const { narratives, overall } = parseNarratives(content, digests);

    expect(overall).toBe("A small day focused on the search work.");
    expect(narratives.get("my-project")).toBe(
      "I shipped the search feature and fixed a typo along the way.",
    );
  });

  test("ignores unknown repo names and empty lines", () => {
    const digests = buildRepoDigests(
      [commit({ repo: "alpha" })],
      new Map(),
    );
    const { narratives, overall } = parseNarratives(
      "unknown: not mine\nalpha:\n\nOVERALL:",
      digests,
    );
    expect(narratives.has("unknown")).toBe(false);
    expect(narratives.has("alpha")).toBe(false);
    expect(overall).toBeUndefined();
  });

  test("drops Qwen <think> blocks before parsing", () => {
    const withThink = [
      "<think>",
      "Let me plan the answer carefully.",
      "</think>",
      "my-project: I shipped the search feature.",
    ].join("\n");
    const truncated = "my-project: answer\n<think>thinking cut off";

    const stripped = stripThinkBlocks(withThink);
    const strippedTruncated = stripThinkBlocks(truncated);

    expect(stripped.trim()).toBe("my-project: I shipped the search feature.");
    expect(strippedTruncated.trim()).toBe("my-project: answer");
  });
});
