import { describe, expect, it } from "vitest";
import { extractApiErrorMessage } from "../../app/utils/api-errors";

describe("extractApiErrorMessage", () => {
  it("returns nested zod issue messages with a field path", () => {
    expect(
      extractApiErrorMessage(
        {
          error: {
            issues: [
              {
                path: ["cta_url"],
                message: "Valid CTA URL required",
              },
            ],
          },
        },
        "Fallback"
      )
    ).toBe("cta_url: Valid CTA URL required");
  });

  it("returns nested object messages instead of object toString output", () => {
    expect(
      extractApiErrorMessage(
        {
          message: {
            message: "Content must be at least 50 characters",
          },
        },
        "Fallback"
      )
    ).toBe("Content must be at least 50 characters");
  });
});
