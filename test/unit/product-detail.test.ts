import { describe, expect, it } from "vitest";
import {
  getInitialPublicMarketplace,
  getProductEditorialSections,
  getProductDetailTitleClass,
  getPublicProductPageCallout,
} from "../../app/utils/product-detail";

describe("product detail helpers", () => {
  it("uses a more compact title scale for very long product names", () => {
    expect(
      getProductDetailTitleClass(
        "PULIOU Compression Socks for Women Men,20-30mmHg Graduated Circulation, for Nurses,Flying,Travel,Athletic,Running,Cycling"
      )
    ).toContain("md:text-3xl");
  });

  it("keeps the larger title scale for normal product names", () => {
    expect(getProductDetailTitleClass("Cordless Vacuum Cleaner")).toContain("md:text-4xl");
  });

  it("returns a country-specific guidance callout for generic public product pages", () => {
    const callout = getPublicProductPageCallout();

    expect(callout.eyebrow).toBe("Amazon destination");
    expect(callout.title).toContain("Amazon");
    expect(callout.body).toContain("leave DealsRky");
  });

  it("prefers the current product marketplace when picking the public deal button target", () => {
    expect(getInitialPublicMarketplace(["DE", "UK"], "DE")).toBe("DE");
  });

  it("falls back to the first available public marketplace when the current marketplace is missing", () => {
    expect(getInitialPublicMarketplace(["DE", "UK"], "US")).toBe("DE");
  });

  it("parses labeled editorial content into structured sections", () => {
    const sections = getProductEditorialSections(
      [
        "Overview: Air Fryer is positioned as a practical everyday kitchen pick.",
        "Who this fits: It should suit buyers who want quick weeknight cooking with simple controls.",
        "What to check: The basket size and counter footprint should match your normal routine.",
        "Feature highlights:\n• Digital controls\n• Basket design",
        "Before you buy on Amazon: Confirm live pricing, shipping details, and recent reviews on Amazon before checkout.",
      ].join("\n\n")
    );

    expect(sections).toHaveLength(5);
    expect(sections[0]).toEqual({
      heading: "Overview",
      body: "Air Fryer is positioned as a practical everyday kitchen pick.",
      bullets: [],
    });
    expect(sections[3]).toEqual({
      heading: "Feature highlights",
      body: "",
      bullets: ["Digital controls", "Basket design"],
    });
  });
});
