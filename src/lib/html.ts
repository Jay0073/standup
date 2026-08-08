export interface DigestBlock {
  name: string;
  statsLine: string;
  typesLine: string;
  narrative: string;
  filesLine: string;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const STYLE = `body{font-family:'Segoe UI',system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#1a1a1a;line-height:1.5}
h1{font-size:1.35rem;border-bottom:2px solid #2d6cdf;padding-bottom:.4rem}
h2{font-size:1.05rem;margin:1.5rem 0 .3rem;color:#2d6cdf}
.meta{color:#888;font-size:.85rem;margin-bottom:1.2rem}
.stats{font-weight:600;margin:.2rem 0}
.types{color:#666;font-size:.9rem;margin:.1rem 0}
.narrative{margin:.5rem 0}
.files{color:#666;font-size:.85rem;margin:.3rem 0}
.overall{background:#f4f7fd;border-left:3px solid #2d6cdf;padding:.6rem .9rem;border-radius:0 4px 4px 0}`;

export function renderDigestHtml(
  overall: string | undefined,
  blocks: DigestBlock[],
  dateLabel: string,
): string {
  const parts: string[] = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    "<title>standup digest</title>",
    `<style>${STYLE}</style>`,
    "</head>",
    "<body>",
    "<h1>Standup digest</h1>",
    `<p class="meta">${escapeHtml(dateLabel)}</p>`,
  ];

  if (overall) {
    parts.push('<p class="overall">', escapeHtml(overall), "</p>");
  }

  for (const block of blocks) {
    parts.push(`<h2>${escapeHtml(block.name)}</h2>`);
    parts.push(`<p class="stats">${escapeHtml(block.statsLine)}</p>`);
    parts.push(`<p class="types">${escapeHtml(block.typesLine)}</p>`);
    parts.push(`<p class="narrative">${escapeHtml(block.narrative)}</p>`);
    if (block.filesLine) {
      parts.push(`<p class="files">${escapeHtml(block.filesLine)}</p>`);
    }
  }

  parts.push("</body>", "</html>");
  return parts.join("\n");
}
