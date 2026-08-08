#!/usr/bin/env bun

import { pc } from "./lib/color.ts";
import { loadProjectEnv } from "./lib/env.ts";
import { DateParseError, parseDateRange } from "./lib/dates.ts";
import { countFilesByCommit, groupCommitsByHour } from "./lib/group.ts";
import { discoverRepos, fetchLog, type Repo } from "./lib/git.ts";
import { renderSummary } from "./lib/format.ts";
import { buildRepoDigests, describeTypes, formatStatsLine } from "./lib/digest.ts";
import { generateNarratives, pickModel } from "./lib/ai.ts";

const USAGE = `standup - summarize yesterday's commits across repositories

Usage:
  standup [--since <date>] [--until <date>]
  standup --digest [--since <date>] [--until <date>]

Scans the current directory for git repositories and prints commits
grouped by repository and by hour, plus the most changed files.

With --digest, writes a narrative report per repository: real git
stats (commits, files, lines added/removed) plus an AI-written
paragraph explaining what was done, generated through Groq.

Environment:
  GROQ_API_KEY     Groq API key (required for --digest)
  STANDUP_MODEL    Groq model id (default: first available Qwen model)

Dates:
  YYYY-MM-DD     e.g. 2026-08-01
  today          start of today
  yesterday      start of yesterday (default --since)
  N days ago     e.g. 3 days ago
  N hours ago    e.g. 2 hours ago

Options:
  --since <date>   Start of the range (default: yesterday 00:00)
  --until <date>   End of the range (default: today 00:00)
  --digest         Print the AI narrative report instead of the commit list
  --help           Show this help`;

class CliError extends Error {}

interface CliArgs {
  since?: string;
  until?: string;
  digest: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { digest: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--digest") {
      args.digest = true;
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

async function runDigest(
  results: { repo: Repo; commits: ReturnType<typeof fetchLog> }[],
): Promise<void> {
  const allCommits = results.flatMap((r) => r.commits);
  const fileCounts = countFilesByCommit(allCommits);
  const digests = buildRepoDigests(allCommits, fileCounts);

  if (digests.length === 0) {
    console.log(pc.dim("No commits in range."));
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.STANDUP_MODEL;
  let narratives = new Map<string, string>();
  let overall: string | undefined;

  if (apiKey) {
    try {
      const chosenModel = await pickModel(apiKey, model);
      const result = await generateNarratives(digests, apiKey, chosenModel);
      narratives = result.narratives;
      overall = result.overall;
      if (process.stdout.isTTY && !model) {
        console.error(pc.dim(`(digest generated with model: ${chosenModel})`));
      }
    } catch (error) {
      console.error(
        pc.yellow(
          `warning: AI narrative failed (${(error as Error).message}); showing stats only`,
        ),
      );
    }
  } else {
    console.error(
      pc.yellow(
        "warning: GROQ_API_KEY is not set; showing stats only. Set it in .env or as a user environment variable.",
      ),
    );
  }

  const lines: string[] = [];
  if (overall) {
    lines.push(pc.bold("Day summary"));
    lines.push(overall);
    lines.push("");
  }
  for (const digest of digests) {
    lines.push(pc.bold(digest.name));
    lines.push(pc.cyan(formatStatsLine(digest)));
    lines.push(pc.dim(describeTypes(digest.types)));
    const narrative = narratives.get(digest.name);
    lines.push(narrative ?? pc.dim("(no narrative)"));
    const top = digest.topFiles.slice(0, 5);
    if (top.length > 0) {
      lines.push(
        pc.dim(
          `  Most changed: ${top.map((t) => `${t.count}x ${t.file}`).join(", ")}`,
        ),
      );
    }
    lines.push("");
  }
  console.log(lines.join("\n").trimEnd());
}

async function main(): Promise<void> {
  loadProjectEnv();
  const {
    since: sinceArg,
    until: untilArg,
    digest,
    help,
  } = parseArgs(process.argv.slice(2));
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

  if (digest) {
    await runDigest(results);
    return;
  }

  const allCommits = results.flatMap((r) => r.commits);
  const groups = groupCommitsByHour(allCommits);
  const fileCounts = countFilesByCommit(allCommits);
  const names = results.map((r) => r.repo.name);

  console.log(renderSummary(names, groups, fileCounts, { includeEmpty: process.stdout.isTTY ?? false }));
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
