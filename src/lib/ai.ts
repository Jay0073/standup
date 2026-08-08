import type { RepoDigest } from "./digest.ts";

const GROQ_BASE = "https://api.groq.com/openai/v1";
const MAX_COMMITS_PER_REPO = 30;
const MAX_MESSAGE_CHARS = 120;

export class GroqError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroqError";
  }
}

export async function pickModel(
  apiKey: string,
  preferred?: string,
): Promise<string> {
  if (preferred) {
    return preferred;
  }

  const res = await fetch(`${GROQ_BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new GroqError(`Groq model list failed with status ${res.status}`);
  }

  const data = (await res.json()) as { data: { id: string }[] };
  const qwen = data.data.map((m) => m.id).filter((id) => /qwen/i.test(id));
  if (qwen.length === 0) {
    throw new GroqError(
      "No Qwen model available on this Groq account; set STANDUP_MODEL",
    );
  }
  return qwen[0]!;
}

export function buildPrompt(digests: RepoDigest[]): string {
  const sections = digests.map((digest) => {
    const messages = digest.commits
      .slice(0, MAX_COMMITS_PER_REPO)
      .map((c) => {
        const message =
          c.message.length > MAX_MESSAGE_CHARS
            ? `${c.message.slice(0, MAX_MESSAGE_CHARS)}\u2026`
            : c.message;
        return `- ${c.hash.slice(0, 7)} ${message}`;
      })
      .join("\n");
    return [
      `Repo: ${digest.name}`,
      `Stats: ${digest.commitCount} commits, ${digest.filesChanged} files changed, +${digest.insertions} \u2212${digest.deletions} lines`,
      `Types: ${describeTypesPlain(digest)}`,
      `Commit messages:\n${messages}`,
    ].join("\n");
  });

  const totals = digests.reduce(
    (acc, d) => ({
      commits: acc.commits + d.commitCount,
      files: acc.files + d.filesChanged,
      insertions: acc.insertions + d.insertions,
      deletions: acc.deletions + d.deletions,
    }),
    { commits: 0, files: 0, insertions: 0, deletions: 0 },
  );
  const totalBlock = [
    "DAY TOTALS:",
    `${totals.commits} commits across ${digests.length} repos, ${totals.files} files changed, +${totals.insertions} \u2212${totals.deletions} lines`,
  ].join("\n");

  return `${sections.join("\n\n")}\n\n${totalBlock}`;
}

function describeTypesPlain(digest: RepoDigest): string {
  const parts = Object.entries(digest.types).map(([type, count]) => `${type} ${count}`);
  return parts.join(", ");
}

const SYSTEM_PROMPT = `You write daily standup summaries for a developer, in the developer's own voice.
For every repo in the data, write a summary paragraph of 4 to 7 sentences that is ready to say out loud.
Base everything ONLY on the data given. Never invent numbers, files, commits, or features. Never quote commit messages verbatim.

A summary is not a list. Make it a narrative with insight:
- What was done, in plain words (themes, not message titles).
- How much was done: weave the real numbers in naturally (commits, files, lines added and removed).
- Insight: what the work means. What mattered most, what the effort split says, what was notable or risky, what is unfinished.
- End with what is worth mentioning in the meeting.

Format rules:
- One paragraph per repo. Start the line with exactly the repo name, then a colon, then the paragraph.
- After all repos, write one final line starting with OVERALL: a 3 to 5 sentence day-level summary across every repo: total work, dominant themes, how the day hangs together.
- Output nothing else. No headers, no markdown, no bullet points.`;

export async function generateNarratives(
  digests: RepoDigest[],
  apiKey: string,
  model: string,
): Promise<{ narratives: Map<string, string>; overall?: string }> {
  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(digests) },
    ],
    temperature: 0.7,
    max_tokens: 4096,
  };

  let data: { choices?: { message?: { content?: string } }[] };
  let attempts = 0;
  while (true) {
    attempts += 1;
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429 && attempts < 3) {
      await new Promise((resolve) => setTimeout(resolve, 20_000 * attempts));
      continue;
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new GroqError(
        `Groq request failed with status ${res.status}${errBody ? `: ${errBody.slice(0, 200)}` : ""}`,
      );
    }
    data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    break;
  }

  const content = data!.choices?.[0]?.message?.content ?? "";
  return parseNarratives(stripThinkBlocks(content), digests);
}

function stripThinkBlocks(content: string): string {
  let text = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  const idx = text.indexOf("<think>");
  if (idx !== -1) {
    text = text.slice(0, idx);
  }
  return text;
}

export { stripThinkBlocks };

export function parseNarratives(
  content: string,
  digests: RepoDigest[],
): { narratives: Map<string, string>; overall?: string } {
  const narratives = new Map<string, string>();
  const names = new Set(digests.map((d) => d.name));
  let overall: string | undefined;

  for (const line of content.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) {
      continue;
    }
    const name = line.slice(0, idx).trim();
    const text = line.slice(idx + 1).trim();
    if (!text) {
      continue;
    }
    if (name === "OVERALL") {
      overall = text;
    } else if (names.has(name)) {
      narratives.set(name, text);
    }
  }

  return { narratives, overall };
}
