import { describe, expect, test } from "bun:test";
import { DateParseError, parseDateRange } from "../src/lib/dates.ts";

const NOW = new Date(2026, 7, 8, 10, 30, 0);

describe("parseDateRange", () => {
  test("defaults to yesterday 00:00 through today 00:00", () => {
    const { since, until } = parseDateRange(undefined, undefined, NOW);
    expect(since).toEqual(new Date(2026, 7, 7, 0, 0, 0));
    expect(until).toEqual(new Date(2026, 7, 8, 0, 0, 0));
  });

  test("accepts ISO dates", () => {
    const { since, until } = parseDateRange("2026-08-01", "2026-08-03", NOW);
    expect(since).toEqual(new Date(2026, 7, 1, 0, 0, 0));
    expect(until).toEqual(new Date(2026, 7, 3, 0, 0, 0));
  });

  test("accepts natural words", () => {
    expect(parseDateRange("yesterday", undefined, NOW).since).toEqual(
      new Date(2026, 7, 7, 0, 0, 0),
    );
    expect(parseDateRange("today", "2026-08-09", NOW).since).toEqual(
      new Date(2026, 7, 8, 0, 0, 0),
    );
  });

  test("accepts relative dates", () => {
    expect(parseDateRange("3 days ago", undefined, NOW).since).toEqual(
      new Date(2026, 7, 5, 10, 30, 0),
    );
    expect(parseDateRange("2 hours ago", "2026-08-09", NOW).since).toEqual(
      new Date(2026, 7, 8, 8, 30, 0),
    );
  });

  test("rejects invalid input", () => {
    expect(() => parseDateRange("not-a-date", undefined, NOW)).toThrow(DateParseError);
    expect(() => parseDateRange("2026-13-01", undefined, NOW)).toThrow(DateParseError);
    expect(() => parseDateRange("2026-08-32", undefined, NOW)).toThrow(DateParseError);
    expect(() => parseDateRange("someday", undefined, NOW)).toThrow(DateParseError);
  });

  test("rejects a range where until is not after since", () => {
    expect(() => parseDateRange("today", "today", NOW)).toThrow(DateParseError);
    expect(() => parseDateRange("2026-08-05", "2026-08-03", NOW)).toThrow(
      DateParseError,
    );
  });

  test("keeps relative time of day for since when until defaults", () => {
    const early = new Date(2026, 7, 8, 1, 30, 0);
    const { since, until } = parseDateRange("2 hours ago", undefined, early);
    expect(since).toEqual(new Date(2026, 7, 7, 23, 30, 0));
    expect(until).toEqual(new Date(2026, 7, 8, 0, 0, 0));
  });
});
