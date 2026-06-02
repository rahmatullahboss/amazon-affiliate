import { describe, expect, it } from "vitest";
import {
  getCreatorsRegionBaseUrl,
  mapCreatorsProductResponse,
} from "../../server/services/creators-api";

describe("Creators API region routing", () => {
  it("routes US and CA to the North America endpoint", () => {
    expect(getCreatorsRegionBaseUrl("US")).toBe("https://creatorsapi-na.amazon.com");
    expect(getCreatorsRegionBaseUrl("CA")).toBe("https://creatorsapi-na.amazon.com");
  });

  it("routes UK, DE, IT, FR, ES to the Europe endpoint", () => {
    for (const marketplace of ["UK", "DE", "IT", "FR", "ES"] as const) {
      expect(getCreatorsRegionBaseUrl(marketplace)).toBe(
        "https://creatorsapi-eu.amazon.com"
      );
    }
  });
});

describe("Creators API response mapping", () => {
  it("maps a full payload to AmazonProductData", () => {
    const result = mapCreatorsProductResponse({
      asin: "B0TEST0001",
      title: "Test Product",
      mainImage: { url: "https://example.com/main.jpg" },
      category: "Electronics",
      description: "A test product",
      features: ["Feature 1", "Feature 2"],
      images: [
        { url: "https://example.com/1.jpg" },
        { url: "https://example.com/2.jpg" },
      ],
      aplusImages: [{ url: "https://example.com/aplus.jpg" }],
    });

    expect(result).toEqual({
      title: "Test Product",
      imageUrl: "https://example.com/main.jpg",
      category: "Electronics",
      description: "A test product",
      features: ["Feature 1", "Feature 2"],
      productImages: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      aplusImages: ["https://example.com/aplus.jpg"],
    });
  });

  it("returns nulls and empty arrays when fields are missing", () => {
    const result = mapCreatorsProductResponse({});
    expect(result).toEqual({
      title: "",
      imageUrl: "",
      category: null,
      description: null,
      features: [],
      productImages: [],
      aplusImages: [],
    });
  });

  it("skips image entries with missing url", () => {
    const result = mapCreatorsProductResponse({
      title: "T",
      mainImage: { url: "https://example.com/main.jpg" },
      images: [
        { url: "https://example.com/1.jpg" },
        { url: null },
        {},
        { url: "https://example.com/2.jpg" },
      ],
    });
    expect(result.productImages).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
  });
});
