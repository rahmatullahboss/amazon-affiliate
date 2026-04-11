import { describe, expect, it } from "vitest";
import { slugifyClientTitle, splitBlogContent } from "../../app/utils/blog";
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
});
