import { describe, expect, it } from "vitest";
import { getPortalProductLinkTargets } from "../../app/utils/portal-product-links";

describe("portal product links", () => {
  it("returns both storefront and redirect targets for a submitted product", () => {
    const targets = getPortalProductLinkTargets({
      storefrontUrl: "https://dealsrky.com/base-agent/it/B0ALIAS01",
      redirectUrl: "https://dealsrky.com/go/base-agent/it/B0ALIAS01",
    });

    expect(targets).toEqual([
      {
        key: "storefront",
        label: "Storefront Link",
        actionLabel: "Copy Storefront",
        openLabel: "Open Storefront",
        url: "https://dealsrky.com/base-agent/it/B0ALIAS01",
      },
      {
        key: "redirect",
        label: "Amazon Redirect",
        actionLabel: "Copy Redirect",
        openLabel: "Open Redirect",
        url: "https://dealsrky.com/go/base-agent/it/B0ALIAS01",
      },
    ]);
  });
});
