export interface PortalProductLinkTarget {
  key: "storefront" | "redirect";
  label: string;
  actionLabel: string;
  openLabel: string;
  url: string;
}

export function getPortalProductLinkTargets(input: {
  storefrontUrl: string;
  redirectUrl: string;
}): PortalProductLinkTarget[] {
  return [
    {
      key: "storefront",
      label: "Storefront Link",
      actionLabel: "Copy Storefront",
      openLabel: "Open Storefront",
      url: input.storefrontUrl,
    },
    {
      key: "redirect",
      label: "Amazon Redirect",
      actionLabel: "Copy Redirect",
      openLabel: "Open Redirect",
      url: input.redirectUrl,
    },
  ];
}
