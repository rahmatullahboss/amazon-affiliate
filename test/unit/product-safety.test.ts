import { describe, expect, it } from "vitest";
import { detectAdultProduct } from "../../server/services/product-safety";

describe("adult product detection", () => {
  it("detects a sexually explicit product from its title", () => {
    const result = detectAdultProduct({
      title:
        "Vibrating Cock Ring, 3 in 1 Couples Toy with Multiple Vibration Modes",
      category: "Health & Personal Care",
    });

    expect(result.isAdult).toBe(true);
    expect(result.reason).toContain("penis or cock ring");
  });

  it("detects adult categories even when the title is vague", () => {
    const result = detectAdultProduct({
      title: "Rechargeable Personal Massager",
      category: "Sexual Wellness",
    });

    expect(result.isAdult).toBe(true);
  });

  it("does not block a normal household product", () => {
    const result = detectAdultProduct({
      title: "5 Inch Foam Interface Pad for Orbital Sander",
      category: "Tools & Home Improvement",
      features: ["Hook and loop backing", "Two piece set"],
    });

    expect(result).toEqual({ isAdult: false, reason: null });
  });
});
