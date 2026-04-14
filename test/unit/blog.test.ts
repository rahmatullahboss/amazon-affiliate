import { describe, expect, it } from "vitest";
import { buildBlogContentHtml, slugifyClientTitle, splitBlogContent } from "../../app/utils/blog";
import { buildBlogImageUrl } from "../../server/services/blog";

describe("blog utils", () => {
  it("normalizes a manual slug into a clean URL-safe value", () => {
    expect(slugifyClientTitle("Admin Sheet!! 2026")).toBe("admin-sheet-2026");
  });

  it("keeps existing hyphenated slug segments intact", () => {
    expect(slugifyClientTitle("admin-sheet-custom")).toBe("admin-sheet-custom");
  });

  it("passes through remote blog image urls without converting them to local asset paths", () => {
    expect(
      buildBlogImageUrl(
        { BLOG_IMAGES_PUBLIC_BASE_URL: "https://cdn.example.com" },
        "https://example.com/product-image.jpg"
      )
    ).toBe("https://example.com/product-image.jpg");
  });

  it("repairs legacy local-prefixed remote blog image urls", () => {
    expect(
      buildBlogImageUrl(
        { BLOG_IMAGES_PUBLIC_BASE_URL: "" },
        "/api/public/blog-images/https://m.media-amazon.com/images/I/example.jpg"
      )
    ).toBe("https://m.media-amazon.com/images/I/example.jpg");
  });

  it("removes legacy inline cta label and raw url paragraphs from blog content", () => {
    expect(
      splitBlogContent(
        [
          "A practical buying paragraph.",
          "",
          "cheak this now",
          "",
          "https://www.amazon.de/dp/B0FQ9SXGYC?tag=feroz3de-21",
        ].join("\n")
      )
    ).toEqual(["A practical buying paragraph."]);
  });

  it("renders stored blog html instead of exposing raw html tags", () => {
    expect(
      buildBlogContentHtml("<h2>Conclusion</h2><p>Paragraph copy.</p>")
    ).toBe("<h2>Conclusion</h2><p>Paragraph copy.</p>");
  });

  it("renders markdown-style headings and paragraphs as separate blocks", () => {
    expect(
      buildBlogContentHtml(
        [
          "First paragraph line.",
          "Second paragraph line.",
          "## Who These Goggles Suit Best",
          "Third paragraph line.",
          "",
          "- Soft foam padding",
          "- UV protection",
        ].join("\n")
      )
    ).toBe(
      "<p>First paragraph line.</p><p>Second paragraph line.</p><h2>Who These Goggles Suit Best</h2><p>Third paragraph line.</p><ul><li>Soft foam padding</li><li>UV protection</li></ul>"
    );
  });

  it("normalizes escaped newline sequences from ai-generated content", () => {
    expect(
      buildBlogContentHtml("Intro line.\\n\\n## Heading\\n\\nBody line.")
    ).toBe("<p>Intro line.</p><h2>Heading</h2><p>Body line.</p>");
  });

  it("removes inline amazon cta label and raw amazon url lines from plain text blog content", () => {
    expect(
      buildBlogContentHtml(
        [
          "A practical buying paragraph.",
          "Cheak details here",
          "https://www.amazon.co.uk/dp/B0DDKPGYTV?tag=feroz3uk-21",
          "Another useful paragraph.",
        ].join("\n")
      )
    ).toBe("<p>A practical buying paragraph.</p><p>Another useful paragraph.</p>");
  });

  it("removes inline buy now labels that already include a deals or amazon url", () => {
    expect(
      buildBlogContentHtml(
        [
          "A practical buying paragraph.",
          "Buy Now: https://dealsrky.com/deals/B0FWKD9TS2",
          "Another useful paragraph.",
        ].join("\n")
      )
    ).toBe("<p>A practical buying paragraph.</p><p>Another useful paragraph.</p>");
  });

  it("removes html buy now paragraphs that include a raw deals url", () => {
    expect(
      buildBlogContentHtml(
        "<p>Summary paragraph.</p><p><strong>Buy Now:</strong> https://dealsrky.com/deals/B0FWKD9TS2</p><p>Closing paragraph.</p>"
      )
    ).toBe("<p>Summary paragraph.</p><p>Closing paragraph.</p>");
  });

  it("turns colon-led feature lines into clearer sub-sections", () => {
    expect(
      buildBlogContentHtml(
        [
          "Absorption and Leak-Proof Protection: Four layers help reduce leaks during long days.",
          "High-Waisted Comfort and Stability: Soft support helps the fit stay in place.",
        ].join("\n")
      )
    ).toBe(
      "<h3>Absorption and Leak-Proof Protection</h3><p>Four layers help reduce leaks during long days.</p><h3>High-Waisted Comfort and Stability</h3><p>Soft support helps the fit stay in place.</p>"
    );
  });

  it("treats plain standalone section titles as headings for better article structure", () => {
    expect(
      buildBlogContentHtml(
        [
          "How It Compares to Alternatives",
          "The wireless CarPlay adapter market includes several brands with similar feature claims.",
          "Related Picks",
          "If you are evaluating car tech upgrades, you may also be interested in:",
          "Conclusion",
          "The Fahren Wireless CarPlay Adapter is a straightforward solution for drivers.",
        ].join("\n")
      )
    ).toBe(
      "<h2>How It Compares to Alternatives</h2><p>The wireless CarPlay adapter market includes several brands with similar feature claims.</p><h2>Related Picks</h2><p>If you are evaluating car tech upgrades, you may also be interested in:</p><h2>Conclusion</h2><p>The Fahren Wireless CarPlay Adapter is a straightforward solution for drivers.</p>"
    );
  });

  it("removes unsafe html and keeps safe formatting tags", () => {
    expect(
      buildBlogContentHtml(
        '<script>alert(1)</script><p onclick="hack()">Safe copy</p><a href="javascript:alert(1)">CTA</a>'
      )
    ).toBe("<p>Safe copy</p><a>CTA</a>");
  });
});
