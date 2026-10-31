import { describe, expect, it } from "vitest";
import {
  REVBID_CONTAINER_ID,
  REVBID_PLACEMENT_ID,
  REVBID_SCRIPT_SRC,
  isRevBidScriptSource,
  shouldEnablePublicAds,
} from "../../app/utils/public-ads";

describe("public ad contract", () => {
  it("keeps the publisher-supplied script sources and container exact", () => {
    expect(REVBID_SCRIPT_SRC).toBe("//prebid.revbid.net/20525/revbid.js");
    expect(REVBID_PLACEMENT_ID).toBe("revbid-mobile");
    expect(REVBID_CONTAINER_ID).toBe("revbid-mobile-3617");
  });

  it("enables ads for web pages and disables them for Capacitor", () => {
    expect(shouldEnablePublicAds(false)).toBe(true);
    expect(shouldEnablePublicAds(true)).toBe(false);
  });

  it("recognizes the script after browsers normalize its protocol-relative URL", () => {
    expect(isRevBidScriptSource(REVBID_SCRIPT_SRC)).toBe(true);
    expect(isRevBidScriptSource("https://prebid.revbid.net/20525/revbid.js")).toBe(true);
    expect(isRevBidScriptSource("https://example.com/20525/revbid.js")).toBe(false);
  });
});
