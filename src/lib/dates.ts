import { isValid, parseISO, startOfDay, subDays, subHours } from "date-fns";

export interface DateRange {
  since: Date;
  until: Date;
}

export class DateParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DateParseError";
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RELATIVE = /^(\d+)\s+(day|days|hour|hours)\s+ago$/;

function parseDate(input: string, now: Date): Date {
  const value = input.trim().toLowerCase();

  if (value === "today") {
    return startOfDay(now);
  }
  if (value === "yesterday") {
    return startOfDay(subDays(now, 1));
  }

  const iso = ISO_DATE.exec(value);
  if (iso) {
    const date = parseISO(value);
    if (!isValid(date)) {
      throw new DateParseError(`Invalid date: "${input}"`);
    }
    return startOfDay(date);
  }

  const relative = RELATIVE.exec(value);
  if (relative) {
    const amount = Number(relative[1]);
    if (relative[2]!.startsWith("day")) {
      return subDays(now, amount);
    }
    return subHours(now, amount);
  }

  throw new DateParseError(
    `Invalid date: "${input}" (expected YYYY-MM-DD, "today", "yesterday", or "N days ago")`,
  );
}

export function parseDateRange(
  sinceInput?: string,
  untilInput?: string,
  now: Date = new Date(),
): DateRange {
  const since = sinceInput ? parseDate(sinceInput, now) : startOfDay(subDays(now, 1));
  const until = untilInput ? parseDate(untilInput, now) : startOfDay(now);

  if (until.getTime() <= since.getTime()) {
    throw new DateParseError(
      `Invalid range: until (${formatDate(until)}) is not after since (${formatDate(since)})`,
    );
  }

  return { since, until };
}

function formatDate(date: Date): string {
  return date.toISOString();
}