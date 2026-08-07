import { describe, expect, test } from "bun:test";

describe("test runner", () => {
  test("is wired up", () => {
    expect(1 + 1).toBe(2);
  });
});
