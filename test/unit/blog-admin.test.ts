import { describe, expect, it } from "vitest";
import { normalizeOptionalUrl, validateBlogDraft } from "../../app/utils/blog-admin";

describe("blog admin helpers", () => {
  it("normalizes amazon urls pasted without protocol", () => {
    expect(normalizeOptionalUrl("www.amazon.com/dp/B0TEST1234?tag=test-20")).toBe(
      "https://www.amazon.com/dp/B0TEST1234?tag=test-20"
    );
  });

  it("blocks too-short content before submitting", () => {
    expect(
      validateBlogDraft({
        title: "Guide",
        content: "Too short",
        cta_url: "",
      })
    ).toBe("Content must be at least 50 characters");
  });

  it("shows a readable error for invalid cta urls", () => {
    expect(
      validateBlogDraft({
        title: "Guide",
        content:
          "This article body is long enough to pass validation before the blog post is submitted.",
        cta_url: "not a url",
      })
    ).toBe("CTA URL must be a valid full URL");
  });
});
