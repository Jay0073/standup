# standup core feature design

Date: 2026-08-08

## Purpose

A CLI that summarizes a day of work for a standup meeting. It reads git logs
from all repositories under the current directory, groups commits by repository
and by hour, shows which files changed most, and prints a plain-text summary
with ANSI colors.

## Inputs

- Flags: `--since <date>` and `--until <date>`.
  - `--since` defaults to yesterday at 00:00 local time.
  - `--until` defaults to today at 00:00 local time.
- Accepted date formats:
  - ISO: `2026-08-01`
  - Natural words: `yesterday`, `today`
  - Relative: `3 days ago`, `1 day ago`, `2 hours ago`
- Invalid date strings produce a typed error. The CLI prints a usage message
  and exits with code 1.
- A range where `until` is before or equal to `since` is an error, same handling.

## Repo discovery

- Recursively scan the current working directory for `.git` entries
  (directories or files, for worktrees). Skip the `.git` folder itself.
- Each found repo is identified by its parent folder name.
- Hidden directories are included, `node_modules` and other dependency
  directories are not skipped on purpose (keep it simple).

## Git log reading

- Per repo, run one command:
  `git log --since <iso> --until <iso> --format=%H|%ad|%s --date=iso-strict --name-only`
- Parse stdout into commit records:

```
Commit {
  repo: string      // parent folder name
  hash: string      // full hash
  date: Date        // author date, local time
  message: string
  files: string[]   // files touched by this commit
}
```

- The range passed to git is inclusive: `--since` and `--until` are translated
  to `--since=<since> --until=<until>`; git includes commits up to the given
  instant, so the defaults (yesterday 00:00, today 00:00) cover yesterday's
  work exactly.

## Grouping

Pure functions in `src/lib/group.ts`:

- `groupCommitsByHour(commits)` -> `{ repo: Map<hourLabel, Commit[]> }`
  - Hour label is the commit date truncated to the hour, formatted `HH:00`.
  - Order: repos sorted by name, hours sorted ascending, commits by date.
- `countFilesByCommit(commits)` -> `{ repo: { file: count }[] }`
  - Counts how many commits touched each file, per repo.
  - Sorted by count descending, then file name ascending.

## Output

Plain text with picocolors ANSI styling. Structure per repo:

```

```
my-project
  09:00
    - 3f4a2b1 add search index
    - 8c1d0e2 fix typo in README
  14:00
    - 9a2b3c4 refactor auth middleware
  Most changed files:
    4x src/auth/middleware.ts
    2x src/search/index.ts
```

- Repo with no commits in range prints `my-project (no commits in range)`.
- A repo that fails to read (not a git repo, git missing) prints a warning and
  the run continues with the remaining repos.

## CLI

- `standup [--since <date>] [--until <date>]`
- Exit codes: 0 success, 1 invalid arguments or date errors, 1 if no repos
  found (with a message).

## Modules

```
src/index.ts        arg parsing, orchestration, exit codes
src/lib/dates.ts    parseDateRange(since?, until?) -> { since, until } (pure)
src/lib/git.ts      discoverRepos(cwd), fetchLog(repoPath, since, until)
src/lib/group.ts    groupCommitsByHour, countFilesByCommit (pure)
src/lib/format.ts   renderSummary(groups, fileCounts) -> string
```

## Testing

bun:test. Tests never call git; pure functions are tested directly.

- `parseDateRange`: ISO, natural words, relative dates, invalid input,
  defaults, `until <= since` error.
- `groupCommitsByHour`: hour boundary bucketing, ordering, empty input,
  multiple repos.
- `countFilesByCommit`: counting, tie order, empty input.
- Integration-style test of the parser for a sample `git log` output string.

## Error handling

- Invalid dates: typed error, usage printed, exit 1.
- No repos found: message, exit 1.
- Repo read failure: warning, continue.
- No commits in range: per-repo placeholder line, exit 0.

## Out of scope

- Merges or renames heuristics, author filtering, `--format markdown`,
  config file, caching, shallow scans, diff size ranking.
