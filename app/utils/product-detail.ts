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

  return reviewContent
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0)
    .map((section) => {
      const [firstLine, ...restLines] = section.split("\n");
      const bulletLines = restLines
        .map((line) => line.trim())
        .filter((line) => line.startsWith("•"))
        .map((line) => line.replace(/^•\s*/, "").trim())
        .filter((line) => line.length > 0);

      const nonBulletLines = restLines
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("•"));

      const separatorIndex = firstLine.indexOf(":");
      if (separatorIndex > 0) {
        const heading = firstLine.slice(0, separatorIndex).trim();
        const firstBodyLine = firstLine.slice(separatorIndex + 1).trim();
        const body = [firstBodyLine, ...nonBulletLines]
          .filter((line) => line.length > 0)
          .join(" ")
          .trim();

        return { heading, body, bullets: bulletLines };
      }

      const body = [firstLine.trim(), ...nonBulletLines].join(" ").trim();
      return {
        heading: "Editorial Summary",
        body,
        bullets: bulletLines,
      };
    });
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
