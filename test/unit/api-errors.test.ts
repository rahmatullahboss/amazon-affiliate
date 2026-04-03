import { describe, expect, it } from "vitest";
import { extractApiErrorMessage } from "../../app/utils/api-errors";

describe("extractApiErrorMessage", () => {
  it("returns the first validation issue as readable text", () => {
    const message = extractApiErrorMessage(
      {
        error: {
          issues: [
            {
              path: ["content"],
              message: "Content must be at least 50 characters",
            },
          ],
        },
      },
      "Fallback message"
    );

    expect(message).toBe("content: Content must be at least 50 characters");
  });
});
