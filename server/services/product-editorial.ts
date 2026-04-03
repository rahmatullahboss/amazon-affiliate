export type EditorialCategory =
  | "home"
  | "kitchen"
  | "cleaning"
  | "beauty"
  | "fashion"
  | "electronics"
  | "outdoor"
  | "fitness"
  | "baby"
  | "pet"
  | "generic";

interface EditorialInput {
  asin: string;
  marketplace: string;
  title: string;
  category: string | null;
  description: string | null;
  features: string[];
  variantOffset?: number;
}

interface MarketplaceToneProfile {
  introStyle: string[];
  fitStyle: string[];
  closingStyle: string[];
}

interface CategoryTemplateProfile {
  introFocus: string[];
  fitFocus: string[];
  featureLead: string[];
}

const CATEGORY_KEYWORDS: Array<{ category: EditorialCategory; keywords: string[] }> = [
  { category: "cleaning", keywords: ["vacuum", "clean", "mop", "sweeper", "floor care"] },
  { category: "kitchen", keywords: ["kitchen", "coffee", "espresso", "air fryer", "cookware", "dining", "blender"] },
  { category: "beauty", keywords: ["beauty", "skin", "makeup", "hair", "cosmetic"] },
  { category: "fashion", keywords: ["fashion", "shoe", "shoes", "bag", "watch", "clothing", "apparel"] },
  { category: "electronics", keywords: ["electronics", "audio", "camera", "headphone", "speaker", "monitor", "laptop", "phone"] },
  { category: "outdoor", keywords: ["outdoor", "garden", "camping", "patio", "bbq", "grill"] },
  { category: "fitness", keywords: ["fitness", "exercise", "gym", "workout", "yoga", "training"] },
  { category: "baby", keywords: ["baby", "infant", "stroller", "nursery", "feeding"] },
  { category: "pet", keywords: ["pet", "dog", "cat", "litter", "aquarium"] },
  { category: "home", keywords: ["home", "furniture", "bedding", "decor", "lamp", "storage"] },
];

const MARKETPLACE_TONES: Record<string, MarketplaceToneProfile> = {
  US: {
    introStyle: ["practical everyday value", "straightforward daily convenience", "reliable day-to-day use"],
    fitStyle: ["works well for busy homes", "fits typical day-to-day routines", "suits buyers who want quick setup and simple use"],
    closingStyle: ["Check the final retailer page for the latest price, delivery timing, and review context before ordering.", "Confirm live pricing, shipping details, and recent customer reviews on the retailer page before checkout."],
  },
  DE: {
    introStyle: ["useful, efficient everyday performance", "solid day-to-day function with a practical focus", "a utility-first setup for regular use"],
    fitStyle: ["should appeal to buyers who care about build confidence and repeatable results", "fits households looking for dependable function over extra gimmicks", "is positioned for practical use where consistency matters"],
    closingStyle: ["Check the final retailer page for current pricing, delivery details, and buyer feedback before you place the order.", "Review live pricing, shipping terms, and customer opinions on the retailer page before checkout."],
  },
  IT: {
    introStyle: ["easy everyday comfort", "a lighter lifestyle-friendly setup", "simple daily convenience with a more flexible feel"],
    fitStyle: ["fits smaller spaces and regular routines especially well", "works well for buyers who want something practical without overcomplicating setup", "should suit everyday home use where convenience matters most"],
    closingStyle: ["Check the final retailer page for the latest pricing, delivery details, and current buyer reviews before ordering.", "Confirm live pricing, shipping details, and customer feedback on the retailer page before purchase."],
  },
  UK: {
    introStyle: ["balanced everyday value", "a convenient option for regular use", "practical value with a simple setup"],
    fitStyle: ["should suit buyers who want useful features without too much friction", "works well for everyday use where convenience and value both matter", "fits households looking for a sensible all-round option"],
    closingStyle: ["Check the final retailer page for the latest pricing, delivery details, and review context before ordering.", "Review live pricing, shipping information, and recent feedback on the retailer page before checkout."],
  },
  CA: {
    introStyle: ["balanced daily usability", "practical everyday flexibility", "a convenient option for regular home use"],
    fitStyle: ["fits routine use where ease and value both matter", "works well for buyers who want straightforward features without extra complexity", "should suit day-to-day household use comfortably"],
    closingStyle: ["Check the final retailer page for current pricing, delivery details, and customer reviews before you place the order.", "Confirm live pricing, shipping timeline, and review context on the retailer page before checkout."],
  },
  FR: {
    introStyle: ["practical everyday comfort", "a more polished everyday-use option", "convenient home-focused usability"],
    fitStyle: ["works well for routine use where convenience matters", "fits buyers who want a simpler day-to-day setup", "should suit regular household use without much friction"],
    closingStyle: ["Check the final retailer page for the latest pricing, delivery details, and customer reviews before ordering.", "Confirm live pricing, shipping details, and buyer feedback on the retailer page before purchase."],
  },
  ES: {
    introStyle: ["easy everyday practicality", "simple day-to-day convenience", "a flexible option for regular household use"],
    fitStyle: ["fits daily routines where quick usability matters", "works well for buyers who want useful features in a simple setup", "should suit regular home use without extra complexity"],
    closingStyle: ["Check the final retailer page for the latest pricing, delivery details, and customer reviews before ordering.", "Confirm live pricing, shipping information, and recent buyer feedback on the retailer page before checkout."],
  },
};

const DEFAULT_MARKETPLACE_TONE = MARKETPLACE_TONES.US;

const CATEGORY_TEMPLATES: Record<EditorialCategory, CategoryTemplateProfile> = {
  home: {
    introFocus: ["a home setup focused on convenience and day-to-day comfort", "a practical home pick designed for regular use", "a useful option for keeping everyday spaces easier to manage"],
    fitFocus: ["It should fit common home routines without demanding much setup.", "It is aimed at buyers who want everyday usefulness more than novelty.", "It looks best suited to regular use across typical home setups."],
    featureLead: ["Useful details worth checking:", "Standout home-use details:", "What this setup highlights:"],
  },
  kitchen: {
    introFocus: ["a kitchen-focused pick built around practical meal prep and convenience", "a kitchen helper that leans into quick routine use", "a cooking-space option aimed at simple, repeatable use"],
    fitFocus: ["It should fit kitchens where speed and convenience matter.", "It makes the most sense for routine cooking or drink prep without a complicated workflow.", "It is positioned for regular kitchen use where simple control matters."],
    featureLead: ["Kitchen-friendly highlights:", "Useful cooking-space details:", "Features that stand out:"],
  },
  cleaning: {
    introFocus: ["a cleaning-focused option built for regular maintenance", "a floor-care style pick aimed at easier routine cleanup", "a practical cleaning tool for day-to-day tidying"],
    fitFocus: ["It should suit buyers who want to keep regular cleanup more manageable.", "It looks geared toward repeat cleaning tasks rather than occasional deep work only.", "It is positioned for routine cleanup where ease of handling matters."],
    featureLead: ["Cleaning-focused highlights:", "Standout cleanup details:", "Useful cleaning features:"],
  },
  beauty: {
    introFocus: ["a beauty-focused option designed around regular personal-care use", "a grooming and care pick that emphasizes easy routine use", "a personal-care setup aimed at everyday convenience"],
    fitFocus: ["It should suit buyers who want a simpler care routine.", "It makes the most sense for regular personal-use sessions where ease matters.", "It is positioned for everyday care rather than one-off specialist use."],
    featureLead: ["Personal-care highlights:", "Useful beauty details:", "Notable care-focused features:"],
  },
  fashion: {
    introFocus: ["a style-led pick with everyday usability in mind", "a fashion-oriented option that aims to stay practical for regular use", "a lifestyle-focused item meant to balance look and routine use"],
    fitFocus: ["It should work best for buyers who want something wearable or giftable with everyday value.", "It looks positioned for regular use where appearance and practicality both matter.", "It is aimed at shoppers who want a simple style-driven choice."],
    featureLead: ["Style-relevant details:", "Useful wearability highlights:", "What stands out here:"],
  },
  electronics: {
    introFocus: ["an electronics pick centered on practical daily performance", "a tech option aimed at routine usability and straightforward features", "a device-focused setup built around common everyday needs"],
    fitFocus: ["It should fit buyers who want dependable everyday tech without unnecessary complexity.", "It looks best suited to regular use where convenience and feature balance matter.", "It is positioned for practical day-to-day use rather than niche specialist needs only."],
    featureLead: ["Tech-focused highlights:", "Useful hardware details:", "Feature points worth checking:"],
  },
  outdoor: {
    introFocus: ["an outdoor-use option shaped around flexible everyday practicality", "a garden or open-air pick built for straightforward use", "an outdoor-oriented setup that focuses on regular usability"],
    fitFocus: ["It should fit buyers who want something manageable for repeat outdoor use.", "It looks geared toward practical outdoor routines rather than occasional novelty use.", "It is positioned for simple open-air use where convenience still matters."],
    featureLead: ["Outdoor-use highlights:", "Practical open-air details:", "Features worth checking:"],
  },
  fitness: {
    introFocus: ["a fitness-oriented option built around regular routine use", "a training-focused pick aimed at simple repeat sessions", "a workout-support product designed for day-to-day use"],
    fitFocus: ["It should suit buyers building a repeatable home or gym routine.", "It looks best for practical training use where simple function matters.", "It is positioned for regular workouts rather than highly specialized use only."],
    featureLead: ["Training-focused highlights:", "Useful workout details:", "What stands out for routine use:"],
  },
  baby: {
    introFocus: ["a baby-focused pick aimed at easier day-to-day care", "a nursery or child-care option designed around routine convenience", "a practical parenting-use product for regular use"],
    fitFocus: ["It should suit parents who want straightforward everyday help.", "It looks positioned for repeat use where convenience and simplicity matter.", "It is aimed at regular care routines rather than occasional edge cases."],
    featureLead: ["Baby-care highlights:", "Useful child-care details:", "What stands out here:"],
  },
  pet: {
    introFocus: ["a pet-focused option designed for regular home use", "a practical pet-care pick built around daily routines", "a home pet-use product aimed at convenience"],
    fitFocus: ["It should fit buyers looking for easier day-to-day pet care.", "It looks best suited to regular pet routines where simple function matters.", "It is positioned for practical home use with pets rather than specialist setups only."],
    featureLead: ["Pet-care highlights:", "Useful pet-use details:", "Features worth checking:"],
  },
  generic: {
    introFocus: ["a practical product find for regular use", "an everyday-use product with a straightforward setup", "a simple option designed around routine convenience"],
    fitFocus: ["It should suit buyers who want practical value from everyday use.", "It looks positioned for simple routine use without much friction.", "It makes the most sense for buyers who prefer a straightforward setup."],
    featureLead: ["Standout details:", "Useful highlights:", "What this product emphasizes:"],
  },
};

export const EDITORIAL_VARIANT_COUNT = 6;

function pickVariant<T>(values: T[], index: number): T {
  return values[index % values.length]!;
}

function sanitizeSentence(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/[.;:,]+$/, "");
}

function sanitizeFeatures(values: string[]): string[] {
  return values
    .map((value) => {
      const clean = sanitizeSentence(value);
      const leadSegment = clean
        .split(/[:.;|]/, 1)[0]
        ?.trim()
        .replace(/^[-•\s]+/, "");

      const normalizedLead = leadSegment && leadSegment.length >= 12 ? leadSegment : clean;

      if (normalizedLead.length <= 60) {
        return normalizedLead;
      }

      const concise = normalizedLead.slice(0, 57).replace(/\s+\S*$/, "").trim();
      if (concise.length > 0) {
        return `${concise}...`;
      }

      if (clean.length <= 90) {
        return clean;
      }

      const truncated = clean.slice(0, 87).replace(/\s+\S*$/, "").trim();
      return `${truncated}...`;
    })
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
    .slice(0, 4);
}

function summarizeTitle(value: string): string {
  const clean = sanitizeSentence(value);
  if (clean.length <= 68) {
    return clean;
  }

  const truncated = clean.slice(0, 65).replace(/\s+\S*$/, "").trim();
  return `${truncated}...`;
}

const AUDIENCE_FOCUS_LINES: Record<EditorialCategory, string[]> = {
  home: [
    "It reads like a fit for buyers who want a straightforward home pick that can slot into normal routines without much friction.",
    "It appears aimed at households that care more about everyday function than novelty-heavy extras.",
  ],
  kitchen: [
    "It seems most relevant for kitchens where repeat use, manageable cleanup, and simple control matter more than novelty.",
    "It reads like a fit for buyers who want cooking convenience without turning the setup into a complicated project.",
  ],
  cleaning: [
    "It appears most suitable for households that need a repeat-use cleaning tool rather than something reserved for occasional deep-clean sessions.",
    "It reads like a fit for buyers who value handling ease, routine convenience, and a setup that can be used without much resistance.",
  ],
  beauty: [
    "It appears aimed at regular personal-care use where convenience and consistency matter more than salon-style specialization.",
    "It reads like a fit for buyers who want to keep a routine manageable without adding too much complexity.",
  ],
  fashion: [
    "It appears aimed at shoppers looking for a practical style-led option rather than something purely trend-driven.",
    "It reads like a fit for buyers who want appearance and regular usability to sit together without too much compromise.",
  ],
  electronics: [
    "It appears aimed at regular everyday use where stable function and convenience matter more than spec-sheet novelty alone.",
    "It reads like a fit for buyers who want useful tech features without a steep learning curve.",
  ],
  outdoor: [
    "It appears aimed at people who care about straightforward open-air use more than feature-heavy complexity.",
    "It reads like a fit for buyers who want a practical outdoor-use setup that can be used repeatedly without much hassle.",
  ],
  fitness: [
    "It appears aimed at regular workout routines where consistency and usability matter more than specialist complexity.",
    "It reads like a fit for buyers who want support for repeat sessions rather than a product designed around niche demands only.",
  ],
  baby: [
    "It appears aimed at repeat use where convenience, predictability, and manageable routines matter most.",
    "It reads like a fit for parents looking for practical daily support rather than a product built only for unusual edge cases.",
  ],
  pet: [
    "It appears aimed at repeat home use where convenience, cleanup, or routine handling matter more than niche extras.",
    "It reads like a fit for owners who want to make normal pet routines more manageable without too much complexity.",
  ],
  generic: [
    "It appears aimed at regular use where convenience and practical fit matter more than novelty alone.",
    "It reads like a fit for buyers who want useful everyday value without turning the purchase into a complicated decision.",
  ],
};

const DECISION_FOCUS_LINES: Record<EditorialCategory, string[]> = {
  home: [
    "The better fit usually comes down to whether its everyday-use profile matches your space and habits.",
    "It is worth judging this type of product by how well its practical details line up with the way it will be used most often.",
  ],
  kitchen: [
    "The main thing to check is whether the capacity, controls, and workflow suit the way you normally cook or prepare drinks.",
    "A sensible decision here usually depends on how well the feature set fits your routine, kitchen space, and expected frequency of use.",
  ],
  cleaning: [
    "The main question is whether the cleaning format, runtime, and handling characteristics match the surfaces and cadence of your normal routine.",
    "A better fit here usually comes down to whether the tool's practical strengths line up with your normal cleanup pattern.",
  ],
  beauty: [
    "The key decision point is whether the design and feature mix genuinely support the routine you expect to use most often.",
    "A strong fit here usually depends on whether the product supports a regular care habit in a way that feels manageable.",
  ],
  fashion: [
    "The main choice usually comes down to whether the balance of look, comfort, and daily usability feels right for the use case you have in mind.",
    "A stronger decision here depends on whether its visual appeal is backed by enough practical everyday value.",
  ],
  electronics: [
    "The key decision is whether the practical feature set matches your real day-to-day tasks rather than just looking strong on paper.",
    "A better fit here usually depends on whether its convenience and capability line up with the way you expect to use it most.",
  ],
  outdoor: [
    "The main question is whether the design, scale, and handling feel right for the kind of outdoor use you expect most often.",
    "A stronger decision here usually comes from matching its practical format to your real outdoor routine rather than an idealized one.",
  ],
  fitness: [
    "The main choice is whether the feature mix actually supports the type of training you repeat most often.",
    "A better fit here usually depends on whether it can support a routine you will realistically maintain.",
  ],
  baby: [
    "The key decision point is whether the product genuinely fits the care routine and safety expectations you need in day-to-day use.",
    "A stronger fit here usually comes down to whether it simplifies normal care routines in a way that feels dependable.",
  ],
  pet: [
    "The main question is whether the product aligns with the routines, animal size, and practical needs you actually deal with most often.",
    "A better decision here usually depends on whether it supports consistent pet care in a way that feels realistic to maintain.",
  ],
  generic: [
    "The main thing to judge is whether the overall feature mix genuinely matches the way you expect to use it most often.",
    "A stronger fit here usually comes from matching the product's simple strengths to your actual routine rather than broad claims.",
  ],
};

function createDeterministicSeed(input: Pick<EditorialInput, "asin" | "marketplace" | "category">): number {
  const source = `${input.asin}:${input.marketplace}:${normalizeEditorialCategory(input.category)}`;
  let total = 0;

  for (const character of source) {
    total = (total * 31 + character.charCodeAt(0)) % 2147483647;
  }

  return total;
}

function normalizeMarketplaceTone(marketplace: string): MarketplaceToneProfile {
  return MARKETPLACE_TONES[marketplace.toUpperCase()] ?? DEFAULT_MARKETPLACE_TONE;
}

export function normalizeEditorialCategory(value: string | null | undefined): EditorialCategory {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) {
    return "generic";
  }

  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.category;
    }
  }

  return "generic";
}

function buildAudienceFocus(category: EditorialCategory, variantIndex: number): string {
  return pickVariant(AUDIENCE_FOCUS_LINES[category], variantIndex);
}

function buildDecisionFocus(category: EditorialCategory, variantIndex: number): string {
  return pickVariant(DECISION_FOCUS_LINES[category], variantIndex);
}

export function buildProductEditorialReview(input: EditorialInput): string | null {
  const category = normalizeEditorialCategory(input.category);
  const tone = normalizeMarketplaceTone(input.marketplace);
  const template = CATEGORY_TEMPLATES[category];
  const features = sanitizeFeatures(input.features);
  const baseSeed = createDeterministicSeed(input);
  const variantIndex = (baseSeed + (input.variantOffset ?? 0)) % EDITORIAL_VARIANT_COUNT;
  const introStyle = pickVariant(tone.introStyle, variantIndex);
  const fitStyle = pickVariant(tone.fitStyle, variantIndex);
  const closingStyle = pickVariant(tone.closingStyle, variantIndex);
  const introFocus = pickVariant(template.introFocus, variantIndex);
  const fitFocus = pickVariant(template.fitFocus, variantIndex);
  const featureLead = pickVariant(template.featureLead, variantIndex);
  const audienceFocus = buildAudienceFocus(category, variantIndex);
  const decisionFocus = buildDecisionFocus(category, variantIndex);
  const sections: string[] = [];
  const titleSummary = summarizeTitle(input.title);

  sections.push(
    `Overview: ${titleSummary} is presented as ${introStyle}, with ${introFocus}.`
  );
  sections.push(`Who this fits: ${audienceFocus}`);
  sections.push(`What to check: ${fitFocus} It ${fitStyle}. ${decisionFocus}`);

  if (features.length > 0) {
    sections.push([
      `Feature highlights: ${featureLead}`,
      ...features.map((feature) => `• ${feature}`),
    ].join("\n"));
  }

  sections.push(`Before you buy on Amazon: ${closingStyle}`);

  const review = sections.join("\n\n");
  if (review.length <= 1200) {
    return review;
  }

  const trimmedSections = [...sections];
  if (features.length > 2) {
    trimmedSections[3] = [
      `Feature highlights: ${featureLead}`,
      ...features.slice(0, 2).map((feature) => `• ${feature}`),
    ].join("\n");
  }

  const trimmedReview = trimmedSections.join("\n\n");
  if (trimmedReview.length <= 1200) {
    return trimmedReview;
  }

  return trimmedReview.slice(0, 1197).replace(/\s+\S*$/, "").trimEnd() + "...";
}
