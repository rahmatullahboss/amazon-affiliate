export interface ProductSafetyInput {
  title?: string | null;
  category?: string | null;
  description?: string | null;
  features?: string[] | string | null;
}

export interface ProductSafetyResult {
  isAdult: boolean;
  reason: string | null;
}

interface AdultPattern {
  label: string;
  pattern: RegExp;
}

const ADULT_PATTERNS: AdultPattern[] = [
  { label: "sexual wellness category", pattern: /\b(?:sexual wellness|adult products?|adult toys?|sex toys?|sex & sensuality)\b/i },
  { label: "vibrator", pattern: /\b(?:vibrators?|vibromasseur|vibratore|vibrador)\b/i },
  { label: "dildo", pattern: /\b(?:dildos?|gode|consolador(?:es)?)\b/i },
  { label: "penis or cock ring", pattern: /\b(?:cock\s*rings?|penis\s*rings?|penile\s*rings?|anneau\s+p[ée]nien|anello\s+(?:per\s+)?pene|anillo\s+(?:para\s+)?pene)\b/i },
  { label: "masturbation product", pattern: /\b(?:masturbators?|male\s+strokers?|penis\s+strokers?|masturbateur|masturbatore|masturbador(?:es)?)\b/i },
  { label: "anal toy", pattern: /\b(?:butt\s*plugs?|anal\s*plugs?|anal\s*beads?|prostate\s+massagers?)\b/i },
  { label: "bondage or BDSM", pattern: /\b(?:bdsm|bondage|fetish\s+gear|sex\s+restraints?)\b/i },
  { label: "sex doll", pattern: /\b(?:sex\s+dolls?|love\s+dolls?|realistic\s+dolls?)\b/i },
  { label: "explicit sexual product", pattern: /\b(?:sex\s+toys?4(?:men|women|couples)|pleasure\s+toys?|erotic\s+toys?|intimate\s+massagers?)\b/i },
  { label: "pornographic content", pattern: /\b(?:porn(?:ographic|ography)?|xxx\s+(?:video|dvd|magazine)|explicit\s+adult)\b/i },
  { label: "sexual health product", pattern: /\b(?:condoms?|personal\s+lubricants?|intimate\s+lubricants?)\b/i },
  { label: "multilingual adult product", pattern: /\b(?:sexspielzeug|giocattol[oi]\s+sessual[ei]|juguetes?\s+sexuales?|jouets?\s+sexuels?)\b/i },
];

function normalizeFeatures(features: ProductSafetyInput["features"]): string {
  if (Array.isArray(features)) {
    return features.join(" ");
  }

  return typeof features === "string" ? features : "";
}

export function detectAdultProduct(input: ProductSafetyInput): ProductSafetyResult {
  const searchableText = [
    input.title,
    input.category,
    input.description,
    normalizeFeatures(input.features),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .replace(/[\s_-]+/g, " ");

  for (const adultPattern of ADULT_PATTERNS) {
    if (adultPattern.pattern.test(searchableText)) {
      return {
        isAdult: true,
        reason: `Auto-detected: ${adultPattern.label}`,
      };
    }
  }

  return { isAdult: false, reason: null };
}
