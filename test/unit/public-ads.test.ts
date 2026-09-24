import { describe, expect, it } from "vitest";
import {
  BOTTOM_SCRIPT_SRC,
  NATIVE_BANNER_CONTAINER_ID,
  NATIVE_BANNER_SCRIPT_SRC,
  shouldEnablePublicAds,
} from "../../app/utils/public-ads";

describe("public ad contract", () => {
  it("keeps the two publisher-supplied Adsterra codes exact", () => {
    expect(NATIVE_BANNER_SCRIPT_SRC).toBe(
      "https://pl30967643.profitableratecpmnetwork.com/c4b4a3c619735916a8b2c83cf2ae6a65/invoke.js"
    );
    expect(NATIVE_BANNER_CONTAINER_ID).toBe(
      "container-c4b4a3c619735916a8b2c83cf2ae6a65"
    );
    expect(BOTTOM_SCRIPT_SRC).toBe(
      "https://pl30967644.profitableratecpmnetwork.com/27/9f/b2/279fb283fc6df4ba2e60428705c80920.js"
    );
  });

  it("enables ads for web pages and disables them for Capacitor", () => {
    expect(shouldEnablePublicAds(false)).toBe(true);
    expect(shouldEnablePublicAds(true)).toBe(false);
  });
});
