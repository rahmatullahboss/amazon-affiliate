import { describe, expect, it } from "vitest";
import { isSuspiciousRequest } from "../../server/middleware/bot-guard";

describe("reviewer access user agents", () => {
  it("does not treat Amazonbot as suspicious", () => {
    expect(
      isSuspiciousRequest(
        "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)"
      )
    ).toBe(false);
  });

  it("keeps curl user agents suspicious", () => {
    expect(isSuspiciousRequest("curl/8.1.2")).toBe(true);
  });
});
