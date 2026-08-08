import { describe, expect, test } from "bun:test";
import { escapeHtml, renderDigestHtml } from "../src/lib/html.ts";

describe("escapeHtml", () => {
  test("escapes markup characters", () => {
    expect(escapeHtml("<script>a & b</script>")).toBe(
      "&lt;script&gt;a &amp; b&lt;/script&gt;",
    );
  });
});

describe("renderDigestHtml", () => {
  test("renders the overall block and repo sections", () => {
    const html = renderDigestHtml(
      "A big day overall.",
      [
        {
          name: "bot",
          statsLine: "4 commits \u00b7 +486 \u221242",
          typesLine: "3 fixes, 1 merge",
          narrative: "I fixed the metrics path.",
          filesLine: "Most changed: 2x api/main.py",
        },
      ],
      "2026-08-08 to 2026-08-09",
    );

    expect(html).toContain("<h1>Standup digest</h1>");
    expect(html).toContain('<p class="overall">');
    expect(html).toContain("A big day overall.");
    expect(html).toContain("<h2>bot</h2>");
    expect(html).toContain('<p class="narrative">');
    expect(html).toContain("I fixed the metrics path.");
    expect(html).toContain("2026-08-08 to 2026-08-09");
  });

  test("escapes untrusted content", () => {
    const html = renderDigestHtml(
      undefined,
      [
        {
          name: "x</h2><script>alert(1)</script>",
          statsLine: "1 commit",
          typesLine: "1 other",
          narrative: "fix <b>bold</b> & more",
          filesLine: "Most changed: 1x a&b.ts",
        },
      ],
      "today",
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a&amp;b.ts");
  });
});
