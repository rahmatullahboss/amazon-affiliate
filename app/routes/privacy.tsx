import type { Route } from "./+types/privacy";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Privacy Policy | DealsRky" },
    {
      name: "description",
      content: "Privacy policy for DealsRky, including analytics and affiliate link handling.",
    },
  ];
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8f8_0%,#ffffff_24%,#f4f6f6_100%)] py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-sm md:p-12">
          <div className="border-b border-gray-100 pb-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">
              Privacy
            </p>
            <h1 className="mt-3 text-3xl font-black text-gray-950 md:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-4 text-sm text-gray-500">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="mt-8 space-y-8 text-sm leading-7 text-gray-600 md:text-base">
            <section>
              <h2 className="text-xl font-bold text-gray-900">Information we collect</h2>
              <p className="mt-3">
                DealsRky stores limited operational data needed to run product pages,
                landing pages, admin tools, and analytics. This may include browser-level
                technical data, approximate location data, and hashed identifiers used for
                traffic reporting.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Analytics and click tracking</h2>
              <p className="mt-3">
                We may record page views, outbound clicks, user agent strings, referrers,
                and similar activity data to understand how products and links perform.
                Some identifiers may be transformed before storage.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Affiliate links</h2>
              <p className="mt-3">
                DealsRky includes links to Amazon. When you click through to Amazon,
                Amazon may use its own cookies or tracking systems to attribute affiliate
                referrals and complete transactions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Third-party services</h2>
              <p className="mt-3">
                This site may rely on third-party infrastructure, analytics tools, and
                Amazon-affiliate redirects. Each third-party provider has its own privacy
                practices and policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-900">Contact</h2>
              <p className="mt-3">
                If you have privacy-related questions about DealsRky, use the contact page
                on this site to reach the site operator.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
