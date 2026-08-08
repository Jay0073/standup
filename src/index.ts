#!/usr/bin/env bun

import pc from "picocolors";
import { DateParseError, parseDateRange } from "./lib/dates.ts";
import { countFilesByCommit, groupCommitsByHour } from "./lib/group.ts";
import { discoverRepos, fetchLog, type Repo } from "./lib/git.ts";
import { renderSummary } from "./lib/format.ts";

const USAGE = `standup - summarize yesterday's commits across repositories

Usage:
  standup [--since <date>] [--until <date>]

Scans the current directory for git repositories and prints commits
grouped by repository and by hour, plus the most changed files.

Dates:
  YYYY-MM-DD     e.g. 2026-08-01
  today          start of today
  yesterday      start of yesterday (default --since)
  N days ago     e.g. 3 days ago
  N hours ago    e.g. 2 hours ago

Options:
  --since <date>   Start of the range (default: yesterday 00:00)
  --until <date>   End of the range (default: today 00:00)
  --help           Show this help`;

class CliError extends Error {}

interface CliArgs {
  since?: string;
  until?: string;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--since" || arg === "--until") {
      const inline = arg.slice(2);
      const value = inline.includes("=")
        ? arg.slice(arg.indexOf("=") + 1)
        : argv[++i];
      if (!value || value.startsWith("--")) {
        throw new CliError(`${arg} requires a value`);
      }
      if (inline.startsWith("since")) {
        args.since = value;
      } else {
        args.until = value;
      }
      continue;
    }
    throw new CliError(`Unknown argument: ${arg}`);
  }

  return args;
}

async function main(): Promise<void> {
  const { since: sinceArg, until: untilArg, help } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(USAGE);
    return;
  }

  const { since, until } = parseDateRange(sinceArg, untilArg);

  const repos = await discoverRepos(process.cwd());
  if (repos.length === 0) {
    console.error(`No git repositories found in ${process.cwd()}`);
    process.exitCode = 1;
    return;
  }

  const results: { repo: Repo; commits: ReturnType<typeof fetchLog> }[] = [];
  for (const repo of repos) {
    try {
      results.push({ repo, commits: fetchLog(repo, since, until) });
    } catch (error) {
      console.error(
        pc.yellow(`warning: skipped ${repo.name}: ${(error as Error).message}`),
      );
    }
  }

  if (results.length === 0) {
    console.error("All repositories failed; nothing to summarize.");
    process.exitCode = 1;
    return;
  }

  const allCommits = results.flatMap((r) => r.commits);
  const groups = groupCommitsByHour(allCommits);
  const fileCounts = countFilesByCommit(allCommits);
  const names = results.map((r) => r.repo.name);

  console.log(renderSummary(names, groups, fileCounts));
}

main().catch((error) => {
  if (error instanceof DateParseError || error instanceof CliError) {
    console.error(pc.red(`error: ${error.message}`));
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  throw error;
});
