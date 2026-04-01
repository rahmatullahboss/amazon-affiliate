type PortalLinkLike = {
  marketplace: string;
};

export function getPortalLinkMarketplaces<T extends PortalLinkLike>(links: T[]): string[] {
  return [...new Set(links.map((link) => link.marketplace))]
    .sort((left, right) => left.localeCompare(right));
}

export function filterPortalLinksByMarketplace<T extends PortalLinkLike>(
  links: T[],
  marketplace: string
): T[] {
  if (!marketplace) {
    return [];
  }

  return links.filter((link) => link.marketplace === marketplace);
}
