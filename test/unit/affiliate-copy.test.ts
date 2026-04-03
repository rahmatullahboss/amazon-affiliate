import { describe, expect, it } from "vitest";
import routes from "../../app/routes";
import {
  AMAZON_DESTINATION_NOTE,
  AMAZON_PRIMARY_CTA_LABEL,
  BROWSE_PICKS_LABEL,
  DEALS_PAGE_TITLE,
  HOME_HERO_EYEBROW,
  HOME_HERO_TITLE,
  INLINE_AFFILIATE_DISCLOSURE,
} from "../../app/utils/affiliate-copy";

describe("affiliate copy", () => {
  it("uses an explicit Amazon CTA label", () => {
    expect(AMAZON_PRIMARY_CTA_LABEL).toBe("View on Amazon");
  });

  it("keeps public navigation aligned on picks wording", () => {
    expect(BROWSE_PICKS_LABEL).toBe("Browse Picks");
  });

  it("keeps the inline disclosure short and specific", () => {
    expect(INLINE_AFFILIATE_DISCLOSURE).toContain("Amazon Associate");
    expect(INLINE_AFFILIATE_DISCLOSURE).toContain("qualifying purchases");
  });

  it("explains that the user is leaving DealsRky for Amazon", () => {
    expect(AMAZON_DESTINATION_NOTE).toContain("Amazon");
    expect(AMAZON_DESTINATION_NOTE).toContain("leave DealsRky");
  });

  it("registers a public terms route", () => {
    expect(JSON.stringify(routes)).toContain("terms");
  });

  it("uses editorial homepage and deals framing instead of live-deals language", () => {
    expect(HOME_HERO_EYEBROW).toContain("Buying Guides");
    expect(HOME_HERO_TITLE).toContain("Amazon");
    expect(DEALS_PAGE_TITLE).toContain("Curated");
  });
});
