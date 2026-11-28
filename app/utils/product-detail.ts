interface ProductEditorialSection {
  heading: string;
  body: string;
  bullets: string[];
}

export function getProductDetailTitleClass(title: string): string {
  const normalizedLength = title.trim().length;

  if (normalizedLength > 90) {
    return "mt-5 text-2xl font-black leading-tight tracking-[-0.02em] text-gray-950 break-words md:text-3xl xl:text-[2.6rem]";
  }

  return "mt-5 text-3xl font-black leading-tight tracking-[-0.02em] text-gray-950 break-words md:text-4xl";
}

/**
 * Product detail renders related cards only for marketplaces available on the
 * current product. Discard hidden candidates before resolving their affiliate
 * tags or serializing them into the loader payload.
 *
 * Keep exact marketplace equality: the UI uses the same equality, and
 * normalizing candidate values here could expose previously hidden cards.
 */
export function filterRenderableRelatedProducts<T extends { marketplace: string | null }>(
  candidates: readonly T[],
  availableMarketplaces: readonly string[],
): T[] {
  const allowed = new Set(availableMarketplaces);
  return candidates.filter((candidate) =>
    candidate.marketplace !== null && allowed.has(candidate.marketplace)
  );
}

export function getInitialPublicMarketplace(
  availableMarketplaces: string[],
  currentMarketplace: string | null | undefined
): string | null {
  const normalizedCurrent = currentMarketplace?.trim().toUpperCase() || null;

  if (normalizedCurrent && availableMarketplaces.includes(normalizedCurrent)) {
    return normalizedCurrent;
  }

  return availableMarketplaces[0] ?? null;
}

export function getProductEditorialSections(
  reviewContent: string | null | undefined
): ProductEditorialSection[] {
  if (!reviewContent) {
    return [];
  }

  const sections: ProductEditorialSection[] = [];
  for (const rawSection of reviewContent.split(/\n{2,}/)) {
    const section = rawSection.trim();
    if (!section) continue;
    const lines = section.split("\n");
    const firstLine = lines[0];
    const separatorIndex = firstLine.indexOf(":");
    const heading = separatorIndex > 0
      ? firstLine.slice(0, separatorIndex).trim()
      : "Editorial Summary";
    const firstBodyLine = (separatorIndex > 0
      ? firstLine.slice(separatorIndex + 1)
      : firstLine).trim();
    const bodyLines: string[] = [];
    const bullets: string[] = [];
    if (firstBodyLine) bodyLines.push(firstBodyLine);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith("•")) {
        const bullet = line.slice(1).trim();
        if (bullet) bullets.push(bullet);
      } else {
        bodyLines.push(line);
      }
    }
    sections.push({ heading, body: bodyLines.join(" "), bullets });
  }
  return sections;
}

export function getPublicProductPageCallout(): {
  eyebrow: string;
  title: string;
  body: string;
} {
  return {
    eyebrow: "Amazon destination",
    title: "Continue to Amazon when you are ready",
    body:
      "Use this page for product research first. When you choose a marketplace, you will leave DealsRky and continue to Amazon for current pricing, delivery details, reviews, and checkout.",
  };
}
