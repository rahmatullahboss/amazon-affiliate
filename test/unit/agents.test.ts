import { describe, expect, it } from "vitest";
import {
  buildAgentFormValues,
  filterAgentsByActivity,
  getHomepageProductCountForAgent,
  getMarketplaceProductCountsForAgent,
  isInlineEditingAgent,
  retainInlineEditingAgentId,
} from "../../app/utils/agents";

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

  it("filters agents by active status", () => {
    const agents = [
      { id: 1, is_active: 1 },
      { id: 2, is_active: 0 },
      { id: 3, is_active: 1 },
    ];

    expect(filterAgentsByActivity(agents, "ALL").map((agent) => agent.id)).toEqual([1, 2, 3]);
    expect(filterAgentsByActivity(agents, "ACTIVE").map((agent) => agent.id)).toEqual([1, 3]);
    expect(filterAgentsByActivity(agents, "INACTIVE").map((agent) => agent.id)).toEqual([2]);
  });

  it("keeps inline editing id only while the agent still exists in the refreshed list", () => {
    expect(
      retainInlineEditingAgentId(14, [
        { id: 13 },
        { id: 14 },
      ])
    ).toBe(14);

    expect(
      retainInlineEditingAgentId(14, [
        { id: 13 },
        { id: 15 },
      ])
    ).toBeNull();
  });

  it("counts homepage-enabled products for an agent", () => {
    expect(
      getHomepageProductCountForAgent(14, [
        { agent_id: 14, show_on_homepage: 1 },
        { agent_id: 14, show_on_homepage: 0 },
        { agent_id: 15, show_on_homepage: 1 },
      ])
    ).toBe(1);
  });

  it("summarizes marketplace product counts for an agent", () => {
    expect(
      getMarketplaceProductCountsForAgent(14, [
        { agent_id: 14, tracking_marketplace: "US" },
        { agent_id: 14, tracking_marketplace: "US" },
        { agent_id: 14, tracking_marketplace: "DE" },
        { agent_id: 15, tracking_marketplace: "UK" },
      ])
    ).toEqual([
      { marketplace: "DE", count: 1 },
      { marketplace: "US", count: 2 },
    ]);
  });
});
