import { describe, expect, it } from "vitest";
import { estimateReadingMinutes } from "../../server/services/blog";

const legacyReadingMinutes = (content: string) => Math.max(
  1,
  Math.ceil(
    content.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length / 220
  )
);

describe("public article reading-time parity", () => {
  it("preserves original whitespace, tag and word-boundary semantics", () => {
    const cases = [
      "", " ", "\n\t\u00a0", "<p></p>", "<p>one</p><span>two</span>",
      "hello-world under_score One Two", "<b>a b</b>\n third",
      "unicode Ωμέγα \u2003 বাংলা \u00a0 terms",
      "<script>alert('x y')</script> trailing", "a".repeat(2000),
      "word ".repeat(219), "word ".repeat(220), "word ".repeat(221),
      "word ".repeat(439), "word ".repeat(440), "word ".repeat(441),
      ...Array.from({ length: 30 }, (_, i) =>
        ("<h2>Title</h2>\nParagraph with tokens\r\n".repeat(i * 13)) +
        (" spaced   phrase ".repeat(i * 27))
      ),
    ];
    for (const input of cases) {
      expect(estimateReadingMinutes(input)).toBe(legacyReadingMinutes(input));
    }
  });
});
