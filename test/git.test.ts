import { describe, expect, test } from "bun:test";
import { parseLogOutput } from "../src/lib/git.ts";

describe("parseLogOutput", () => {
  test("parses commits with metadata and files", () => {
    const stdout = [
      "\u0000abc123|2026-08-07T09:30:00+02:00|add search index",
      "12\t1\tsrc/search/index.ts",
      "4\t2\tsrc/search/types.ts",
      "",
      "\u0000def456|2026-08-07T10:05:00+02:00|fix typo in README",
      "1\t1\tREADME.md",
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

  test("parses --numstat lines into stats and file lists", () => {
    const stdout = [
      "\u0000abc123|2026-08-07T09:30:00+02:00|add search index",
      "10\t3\tsrc/search/index.ts",
      "5\t0\tsrc/search/types.ts",
      "",
      "\u0000def456|2026-08-07T10:05:00+02:00|pure deletion",
      "0\t7\told.txt",
      "",
      "\u0000abc789|2026-08-07T11:00:00+02:00|binary change",
      "-\t-\tsrc/logo.png",
      "",
    ].join("\n");

    const commits = parseLogOutput(stdout, "my-project");

    expect(commits).toHaveLength(3);
    expect(commits[0]).toMatchObject({
      filesChanged: 2,
      insertions: 15,
      deletions: 3,
      files: ["src/search/index.ts", "src/search/types.ts"],
    });
    expect(commits[1]).toMatchObject({
      filesChanged: 1,
      insertions: 0,
      deletions: 7,
      files: ["old.txt"],
    });
    expect(commits[2]).toMatchObject({
      filesChanged: 1,
      insertions: 0,
      deletions: 0,
      files: ["src/logo.png"],
    });
  });

  test("tolerates CRLF line endings (Windows git output)", () => {
    const stdout = [
      "\u0000abc123|2026-08-07T09:30:00+02:00|add search index",
      "15\t3\tsrc/search/index.ts",
      "",
    ].join("\r\n");

    const commits = parseLogOutput(stdout, "my-project");

    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      filesChanged: 1,
      insertions: 15,
      deletions: 3,
      files: ["src/search/index.ts"],
    });
  });
});
