import type { Route } from "./+types/disclosure";
import { buildSeoMeta } from "../utils/seo";

export function meta({}: Route.MetaArgs) {
  return buildSeoMeta({
    title: "Affiliate Disclosure | DealsRky",
    description:
      "Learn how DealsRky uses affiliate links and how Amazon commissions work on this site.",
    path: "/disclosure",
  });
}

export default function AffiliateDisclosure() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_24%,#f4f6f6_100%)] py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm md:p-12">
          <div className="border-b border-gray-100 pb-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
              Transparency
            </p>
            <h1 className="mt-3 text-3xl font-black text-gray-950 md:text-4xl">
              Affiliate Disclosure
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-600 md:text-base">
              DealsRky links to products sold on Amazon. Some links on this site are
              affiliate links, which means DealsRky may earn a commission from qualifying
              purchases.
            </p>
          </div>

          <div className="mt-8 space-y-8 text-sm leading-7 text-gray-600 md:text-base">
            <section className="rounded-[1.5rem] border border-primary/15 bg-primary/5 p-6">
              <p className="font-medium text-gray-800">
                DealsRky is a participant in the Amazon Services LLC Associates Program,
                an affiliate advertising program designed to provide a means for sites to
                earn advertising fees by advertising and linking to Amazon properties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">What this means for you</h2>
              <p className="mt-3">
                If you click an affiliate link on DealsRky and complete an eligible
                purchase on Amazon, DealsRky may receive a commission. This does not add
                extra cost to your purchase.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">How product links work</h2>
              <p className="mt-3">
                DealsRky publishes product pages and route pages that send visitors to
                Amazon for final pricing, checkout, shipping, and returns. Orders are not
                processed on DealsRky.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Editorial independence</h2>
              <p className="mt-3">
                We may earn commissions, but we still aim to keep product selection,
                landing pages, and category coverage useful and consistent for users.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Pricing and availability</h2>
              <p className="mt-3">
                Product pricing, stock, promotions, and shipping information are shown on
                Amazon and may change without notice. Always verify the latest details on
                Amazon before buying.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
