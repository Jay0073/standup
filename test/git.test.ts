import { describe, expect, test } from "bun:test";
import { parseLogOutput } from "../src/lib/git.ts";

describe("parseLogOutput", () => {
  test("parses commits with metadata and files", () => {
    const stdout = [
      "\u0000abc123|2026-08-07T09:30:00+02:00|add search index",
      "src/search/index.ts",
      "src/search/types.ts",
      "",
      "\u0000def456|2026-08-07T10:05:00+02:00|fix typo in README",
      "README.md",
      "",
    ].join("\n");

    const commits = parseLogOutput(stdout, "my-project");

    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({
      repo: "my-project",
      hash: "abc123",
      message: "add search index",
      files: ["src/search/index.ts", "src/search/types.ts"],
    });
    expect(commits[0]!.date).toEqual(
      new Date("2026-08-07T09:30:00+02:00"),
    );
    expect(commits[1]!.files).toEqual(["README.md"]);
  });

  test("handles an empty log", () => {
    expect(parseLogOutput("", "my-project")).toEqual([]);
  });

  test("skips commits with a malformed date", () => {
    const stdout =
      "\u0000abc123|not-a-date|bad commit\nsrc/a.ts\n\u0000def456|2026-08-07T10:05:00+02:00|good commit\n";
    const commits = parseLogOutput(stdout, "my-project");
    expect(commits).toHaveLength(1);
    expect(commits[0]!.message).toBe("good commit");
  });

  test("handles commits with no files", () => {
    const commits = parseLogOutput(
      "\u0000abc123|2026-08-07T10:05:00+02:00|empty commit\n\n",
      "my-project",
    );
    expect(commits).toHaveLength(1);
    expect(commits[0]!.files).toEqual([]);
  });
});
