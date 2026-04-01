import { describe, expect, it } from "vitest";
import { buildAgentFormValues, isInlineEditingAgent } from "../../app/utils/agents";

describe("agent admin helpers", () => {
  it("builds editable form values from an existing agent", () => {
    expect(
      buildAgentFormValues({
        name: "Sajib",
        slug: "sajibusa",
        email: "sajib@example.com",
        phone: "01700000000",
      })
    ).toEqual({
      name: "Sajib",
      slug: "sajibusa",
      email: "sajib@example.com",
      phone: "01700000000",
    });
  });

  it("matches the inline editing card by agent id", () => {
    expect(isInlineEditingAgent(14, 14)).toBe(true);
    expect(isInlineEditingAgent(14, 15)).toBe(false);
    expect(isInlineEditingAgent(null, 14)).toBe(false);
  });
});
