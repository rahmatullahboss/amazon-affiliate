import { describe, expect, it } from "vitest";
import { isReviewerUserAgent, isSuspiciousRequest } from "../../server/middleware/bot-guard";

describe("reviewer access user agents", () => {
  it("treats the pure Amazonbot reviewer UA as allowed for the public redirect flow", () => {
    const userAgent = "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)";

    expect(isReviewerUserAgent(userAgent)).toBe(true);
    expect(isSuspiciousRequest(userAgent, { allowReviewerAccess: true })).toBe(false);
  });

  it("keeps curl user agents suspicious", () => {
    expect(isSuspiciousRequest("curl/8.1.2")).toBe(true);
  });

  it("keeps mixed curl plus Amazonbot user agents suspicious", () => {
    expect(
      isSuspiciousRequest("curl/8.1.2 Amazonbot/0.1", { allowReviewerAccess: true })
    ).toBe(true);
  });
});
