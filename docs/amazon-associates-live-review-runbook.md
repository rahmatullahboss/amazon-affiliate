# Amazon Associates Live Review Runbook

Use this runbook immediately after deployment and before any reapplication or appeal.

## 1. Verify Public Policy Pages

Open these pages in a browser and confirm they load without login prompts:

- `/`
- `/deals`
- `/blog`
- `/about`
- `/contact`
- `/privacy`
- `/disclosure`
- `/terms`

What to confirm:

- Header disclosure is visible
- Footer policy links are visible
- Terms page is linked from the footer
- The homepage reads like an editorial recommendation site, not a coupon directory

## 2. Verify Reviewer Access and Robots

Run these commands against the live domain:

```bash
curl -I https://dealsrky.com/robots.txt
curl -A "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)" https://dealsrky.com/robots.txt
```

What to confirm:

- Response status is `200`
- Output does not contain `User-agent: Amazonbot`
- Output does not contain a blanket `Disallow: /`
- `/go/` and `/t/` can stay disallowed in `robots.txt`

If live `robots.txt` still blocks Amazonbot after deployment, fix the Cloudflare-managed layer before reapplying.

## 3. Verify Public Redirect Validation

Pick one live active ASIN for each target marketplace you care about, then test:

```bash
curl -I -A "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)" "https://dealsrky.com/go/p/us/<US_ASIN>"
curl -I -A "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)" "https://dealsrky.com/go/p/uk/<UK_ASIN>"
curl -I -A "Mozilla/5.0 (compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot)" "https://dealsrky.com/go/p/de/<DE_ASIN>"
```

What to confirm:

- Response status is `302`
- `Location` points to the correct Amazon marketplace
- `Location` contains the correct `tag=...` value for that marketplace

Also verify the blocked case still works:

```bash
curl -I -A "curl/8.1.2 Amazonbot/0.1" "https://dealsrky.com/go/p/us/<US_ASIN>"
```

What to confirm:

- Response status is `403`

## 4. Verify Product Page Compliance Signals

Open at least one public product page per marketplace in a browser.

What to confirm on each page:

- CTA text says `View on Amazon`
- CTA-adjacent copy makes it clear the user will leave DealsRky and continue to Amazon
- Inline affiliate disclosure appears near the CTA
- If multiple marketplaces exist, the selector changes the CTA target correctly
- No fixed Amazon price is shown on the page

## 5. Verify Bridge Page Compliance Signals

Open at least one bridge page from an agent/public storefront path.

What to confirm:

- Primary CTA says `View on Amazon`
- Secondary CTA says `Check on Amazon`
- CTA links use Amazon-bound affiliate flow
- Inline disclosure appears near the CTA
- Mobile CTA also uses Amazon-explicit wording

## 6. Verify Tagged Link Integrity

For US, UK, and DE at minimum:

- Click a product CTA from the public product page
- Click a CTA from the bridge page
- Inspect the destination URL after redirect

What to confirm:

- Correct Amazon domain is used
- Correct marketplace tag is present
- No wrong-country mismatch occurs
- No broken or expired ASIN landing pages appear

## 7. Verify Editorial Quality Threshold

Before reapplying:

- Publish at least 10 original blog posts
- Manually review 20 to 30 public product pages
- Remove weak or thin product pages that do not add meaningful editorial value
- Prefer buying-guide and recommendation framing over urgency-led deal language

## 8. Reapplication Order

Recommended order:

1. Deploy the current compliance and copy changes.
2. Run this live checklist.
3. Fix any live crawler, redirect, or wrong-tag issues.
4. Publish the remaining original blog content.
5. Recheck US, UK, and DE manually.
6. Only then submit a new application or appeal.

## 9. Evidence to Keep

Before reapplying, save screenshots of:

- Homepage hero and footer disclosure
- Terms page
- Product page CTA plus inline disclosure
- Bridge page CTA plus inline disclosure
- Redirect header output showing `302` and the correct `tag=...`
- Live `robots.txt` showing Amazonbot is not blocked
