import type { Route } from "./+types/about";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About | DealsRky" },
    {
      name: "description",
      content: "About DealsRky and how the site curates Amazon product pages and affiliate links.",
    },
  ];
}

export default function About() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_24%,#f4f6f6_100%)] py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm md:p-12">
          <div className="border-b border-gray-100 pb-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl">
              D
            </div>
            <h1 className="mt-6 text-3xl font-black text-gray-950 md:text-5xl">
              About <span className="text-primary">DealsRky</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600">
              DealsRky is a curated Amazon affiliate storefront built to publish useful
              product pages, route users to Amazon for checkout, and keep the buying
              journey clear and transparent.
            </p>
          </div>

          <div className="mt-8 space-y-8 text-sm leading-7 text-gray-600 md:text-base">
            <section>
              <h2 className="text-xl font-bold text-gray-900">What the site does</h2>
              <p className="mt-3">
                DealsRky maintains product landing pages, category browsing, and tracked
                outbound links that lead to Amazon. We do not operate a shopping cart,
                warehouse, or payment system for customer purchases.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">How products appear here</h2>
              <p className="mt-3">
                Products can be added through the internal admin workflow, the agent
                portal, or synchronized product-ingestion channels such as Google Sheets.
                Product pages are then published on the site and linked to Amazon.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Transparency matters</h2>
              <p className="mt-3">
                DealsRky uses affiliate links. If you are new to this model, review our{" "}
                <Link to="/disclosure" className="font-semibold text-primary hover:underline">
                  affiliate disclosure
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="font-semibold text-primary hover:underline">
                  privacy policy
                </Link>
                .
              </p>
            </section>

            <section className="rounded-[1.5rem] border border-gray-200 bg-gray-50 p-6">
              <h2 className="text-xl font-bold text-gray-900">What DealsRky is not</h2>
              <p className="mt-3">
                DealsRky is not Amazon, not a reseller, and not the merchant of record for
                orders completed on Amazon. Pricing, stock, delivery, and returns are
                controlled by Amazon.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
