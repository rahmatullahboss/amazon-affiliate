import type { Route } from "./+types/terms";
import { buildSeoMeta } from "../utils/seo";

export function meta({}: Route.MetaArgs) {
  return buildSeoMeta({
    title: "Terms of Use | DealsRky",
    description: "Terms of use for DealsRky public visitors and affiliate-link readers.",
    path: "/terms",
  });
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_24%,#f4f6f6_100%)] py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm md:p-12">
          <div className="border-b border-gray-100 pb-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
              Terms
            </p>
            <h1 className="mt-3 text-3xl font-black text-gray-950 md:text-4xl">
              Terms of Use
            </h1>
          </div>

          <div className="mt-8 space-y-8 text-sm leading-7 text-gray-600 md:text-base">
            <section>
              <h2 className="text-xl font-bold text-gray-900">Informational use</h2>
              <p className="mt-3">
                DealsRky publishes editorial product information for research and
                discovery. Content on this site is informational and does not create
                a purchase contract.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Retailer responsibility</h2>
              <p className="mt-3">
                Final pricing, stock, delivery, returns, and checkout are handled by
                Amazon or the final retailer, not by DealsRky.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Affiliate relationship</h2>
              <p className="mt-3">
                Some links on DealsRky are affiliate links. As an Amazon Associate,
                DealsRky earns from qualifying purchases.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Contact</h2>
              <p className="mt-3">
                Questions about site usage can be sent through the DealsRky contact
                page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
