import { describe, expect, it } from "vitest";
import {
  buildProductEditorialReview,
  normalizeEditorialCategory,
} from "../../server/services/product-editorial";

describe("product editorial templates", () => {
  it("maps noisy category labels into stable editorial groups", () => {
    expect(normalizeEditorialCategory("Vacuum Cleaners")).toBe("cleaning");
    expect(normalizeEditorialCategory("Kitchen & Dining")).toBe("kitchen");
    expect(normalizeEditorialCategory("Unknown Vertical")).toBe("generic");
  });

  it("produces different deterministic review content across marketplaces", () => {
    const usReview = buildProductEditorialReview({
      asin: "B0TEMPLATE1",
      marketplace: "US",
      title: "Cordless Vacuum",
      category: "Vacuum Cleaners",
      description: "A lightweight cordless vacuum for daily floor cleanup.",
      features: ["Up to 40 minutes runtime", "LED floor head", "Easy bin emptying"],
      variantOffset: 0,
    });

    const deReview = buildProductEditorialReview({
      asin: "B0TEMPLATE1",
      marketplace: "DE",
      title: "Cordless Vacuum",
      category: "Vacuum Cleaners",
      description: "A lightweight cordless vacuum for daily floor cleanup.",
      features: ["Up to 40 minutes runtime", "LED floor head", "Easy bin emptying"],
      variantOffset: 0,
    });

    expect(usReview).not.toBeNull();
    expect(deReview).not.toBeNull();
    expect(usReview).not.toBe(deReview);
  });

  it("changes content when the variant offset changes", () => {
    const first = buildProductEditorialReview({
      asin: "B0TEMPLATE2",
      marketplace: "IT",
      title: "Espresso Machine",
      category: "Coffee Machines",
      description: "Compact espresso machine for small kitchens.",
      features: ["Milk frother", "Slim footprint", "Simple controls"],
      variantOffset: 0,
    });

    const second = buildProductEditorialReview({
      asin: "B0TEMPLATE2",
      marketplace: "IT",
      title: "Espresso Machine",
      category: "Coffee Machines",
      description: "Compact espresso machine for small kitchens.",
      features: ["Milk frother", "Slim footprint", "Simple controls"],
      variantOffset: 1,
    });

    expect(first).not.toBe(second);
  });

  it("falls back gracefully when description and features are sparse", () => {
    const review = buildProductEditorialReview({
      asin: "B0TEMPLATE3",
      marketplace: "UK",
      title: "Desk Lamp",
      category: null,
      description: null,
      features: [],
      variantOffset: 0,
    });

    expect(review).toContain("Desk Lamp");
    expect(review).toContain("Amazon");
  });

  it("keeps generated output stable for the same product seed", () => {
    const input = {
      asin: "B0STABLE12",
      marketplace: "US",
      title: "Air Fryer",
      category: "Kitchen Appliances",
      description: "Compact air fryer for weeknight meals.",
      features: ["Digital controls", "Basket design", "Fast preheat"],
      variantOffset: 0,
    };

    expect(buildProductEditorialReview(input)).toBe(buildProductEditorialReview(input));
  });
});
