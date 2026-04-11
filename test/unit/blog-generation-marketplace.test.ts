import { describe, expect, it } from "vitest";
import { chooseFocusProductCandidate } from "../../server/services/blog-generation";

describe("blog generation marketplace selection", () => {
  it("prefers the least recently covered marketplace when multiple candidates exist", () => {
    const selected = chooseFocusProductCandidate(
      [
        {
          asin: "B0US001",
          title: "US Product",
          marketplace: "US",
          category: "Kitchen",
          review_content: "US summary",
          features: '["Compact"]',
          updated_at: "2026-04-04T10:00:00.000Z",
        },
        {
          asin: "B0DE001",
          title: "DE Product",
          marketplace: "DE",
          category: "Kitchen",
          review_content: "DE summary",
          features: '["Leise"]',
          updated_at: "2026-04-04T09:00:00.000Z",
        },
      ],
      {
        US: {
          recentCount: 2,
          lastGeneratedAt: "2026-04-04T08:00:00.000Z",
        },
        DE: {
          recentCount: 0,
          lastGeneratedAt: null,
        },
      }
    );

    expect(selected?.marketplace).toBe("DE");
    expect(selected?.asin).toBe("B0DE001");
  });

  it("falls back to the freshest candidate inside the same marketplace bucket", () => {
    const selected = chooseFocusProductCandidate(
      [
        {
          asin: "B0ES001",
          title: "Older ES Product",
          marketplace: "ES",
          category: "Fitness",
          review_content: "Older",
          features: '["Ligero"]',
          updated_at: "2026-04-04T07:00:00.000Z",
        },
        {
          asin: "B0ES002",
          title: "Fresh ES Product",
          marketplace: "ES",
          category: "Fitness",
          review_content: "Fresh",
          features: '["Nuevo"]',
          updated_at: "2026-04-04T11:00:00.000Z",
        },
      ],
      {}
    );

    expect(selected?.marketplace).toBe("ES");
    expect(selected?.asin).toBe("B0ES002");
  });
});
