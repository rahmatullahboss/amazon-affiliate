import { describe, expect, it } from "vitest";
import { filterPortalLinksByMarketplace, getPortalLinkMarketplaces } from "../../app/utils/portal-links";

const links = [
  {
    agentSlug: "agent-uk",
    agentName: "Agent",
    asin: "B0UK000001",
    marketplace: "UK",
    title: "UK Product",
    imageUrl: "http://img.com/uk.jpg",
    bridgePageUrl: "https://dealsrky.com/agent-uk/uk/B0UK000001",
    redirectUrl: "https://dealsrky.com/go/agent-uk/uk/B0UK000001",
  },
  {
    agentSlug: "agent-de",
    agentName: "Agent",
    asin: "B0DE000001",
    marketplace: "DE",
    title: "DE Product",
    imageUrl: "http://img.com/de.jpg",
    bridgePageUrl: "https://dealsrky.com/agent-de/de/B0DE000001",
    redirectUrl: "https://dealsrky.com/go/agent-de/de/B0DE000001",
  },
  {
    agentSlug: "agent-uk",
    agentName: "Agent",
    asin: "B0UK000002",
    marketplace: "UK",
    title: "UK Product 2",
    imageUrl: "http://img.com/uk2.jpg",
    bridgePageUrl: "https://dealsrky.com/agent-uk/uk/B0UK000002",
    redirectUrl: "https://dealsrky.com/go/agent-uk/uk/B0UK000002",
  },
];

describe("portal links marketplace helpers", () => {
  it("returns unique sorted marketplaces from the links payload", () => {
    expect(getPortalLinkMarketplaces(links)).toEqual(["DE", "UK"]);
  });

  it("hides the product list until a marketplace is selected", () => {
    expect(filterPortalLinksByMarketplace(links, "")).toEqual([]);
    expect(filterPortalLinksByMarketplace(links, "UK")).toHaveLength(2);
    expect(filterPortalLinksByMarketplace(links, "DE")).toHaveLength(1);
  });
});
