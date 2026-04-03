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

  it("produces richer multi-section editorial copy", () => {
    const review = buildProductEditorialReview({
      asin: "B0RICHCOPY1",
      marketplace: "US",
      title: "Air Fryer",
      category: "Kitchen Appliances",
      description: "Compact air fryer for weeknight meals.",
      features: ["Digital controls", "Basket design", "Fast preheat"],
      variantOffset: 0,
    });

    expect(review).toContain("Air Fryer");
    expect(review).toContain("Digital controls");
    expect(review).toContain("Amazon");
    expect(review).toContain("Who this fits:");
    expect(review).toContain("What to check:");
    expect(review).toContain("Before you buy on Amazon:");
    expect(review?.split("\n\n").length).toBeGreaterThanOrEqual(4);
    expect((review?.length ?? 0) > 220).toBe(true);
  });

  it("does not reuse imported product description text in the generated summary", () => {
    const review = buildProductEditorialReview({
      asin: "B0LONGDESC1",
      marketplace: "US",
      title: "Vent Filter",
      category: "Home",
      description:
        "Improve Air Quality Breathe cleaner air with our high-efficiency Vent Filter. Designed to capture dust, pet hair, pollen, and other airborne particles, it helps reduce allergens and improve indoor air quality. Easy Installation No tools required simply install the filter on any standard vent. Durable and reusable materials support longer-term use around the home.",
      features: ["Captures dust", "Cut to size", "Triple layer"],
      variantOffset: 0,
    });

    expect((review?.length ?? 0) < 1200).toBe(true);
    expect(review).not.toContain("Improve Air Quality");
    expect(review).not.toContain("No tools required");
  });

  it("keeps extreme imported titles from dominating the summary", () => {
    const review = buildProductEditorialReview({
      asin: "B0LONGTITLE1",
      marketplace: "ES",
      title:
        "Vibrator Woman Erotic Toys Realistic Dildo Vibrator with 3-speed 10 Modes Vibrators for Women Adult Couple Use for Bedroom Travel and Everyday Storage Case Included",
      category: "Beauty",
      description:
        "Compact personal-care option intended for regular use with a simple setup and a convenience-focused design.",
      features: [
        "3 speeds and 10 vibration modes for varied intensity",
        "Storage case included for tidier organization",
        "Compact size for easier travel packing",
      ],
      variantOffset: 0,
    });

    expect(review).toContain("...");
    expect((review?.length ?? 0) < 1200).toBe(true);
  });
});
