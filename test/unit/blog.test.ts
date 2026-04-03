import { describe, expect, it } from "vitest";
import { slugifyClientTitle } from "../../app/utils/blog";

describe("blog utils", () => {
  it("normalizes a manual slug into a clean URL-safe value", () => {
    expect(slugifyClientTitle("Admin Sheet!! 2026")).toBe("admin-sheet-2026");
  });

  it("keeps existing hyphenated slug segments intact", () => {
    expect(slugifyClientTitle("admin-sheet-custom")).toBe("admin-sheet-custom");
  });
});
