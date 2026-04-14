import { describe, expect, it } from "vitest";
import {
  buildShareLinks,
  normalizeShareUrl,
} from "../../app/utils/share-links";

describe("share links", () => {
  it("normalizes relative paths against the public site url", () => {
    expect(normalizeShareUrl("/deals/B0TEST1234")).toBe(
      "https://dealsrky.com/deals/B0TEST1234"
    );
  });

  it("builds platform share links for supported channels", () => {
    const links = buildShareLinks({
      url: "/blog/example-post",
      title: "Example Post",
    });

    expect(links.facebook).toContain("facebook.com");
    expect(links.x).toContain("twitter.com");
    expect(links.whatsapp).toContain("wa.me");
    expect(links.telegram).toContain("t.me");
  });
});
