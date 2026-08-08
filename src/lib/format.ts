import type { FileCounts, HourGroups } from "./group.ts";
import { pc } from "./color.ts";

const TOP_FILES = 5;

export interface RenderOptions {
  includeEmpty?: boolean;
}

export function renderSummary(
  repoNames: string[],
  groups: HourGroups,
  fileCounts: FileCounts,
  options: RenderOptions = {},
): string {
  const { includeEmpty = true } = options;
  const lines: string[] = [];

  for (const name of repoNames) {
    const hours = groups.get(name);
    if ((!hours || hours.size === 0) && !includeEmpty) {
      continue;
    }
    lines.push(pc.bold(name));
    if (!hours || hours.size === 0) {
      lines.push(pc.dim("  (no commits in range)"));
      continue;
    }
    for (const [label, commits] of hours) {
      lines.push(`  ${pc.cyan(label)}`);
      for (const commit of commits) {
        lines.push(`    - ${pc.dim(commit.hash.slice(0, 7))} ${commit.message}`);
      }
    }
    const counts = fileCounts.get(name) ?? [];
    if (counts.length > 0) {
      lines.push(pc.dim("  Most changed files:"));
      for (const { file, count } of counts.slice(0, TOP_FILES)) {
        lines.push(`    ${pc.yellow(`${count}x`)} ${file}`);
      }
    }
  }

  return lines.join("\n");
}
