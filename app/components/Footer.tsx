import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-[#102020] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-black text-white">
              D
            </div>
            <div>
              <p className="text-lg font-black">DealsRky</p>
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">
                Curated Amazon storefront
              </p>
            </div>
          </div>

          <p className="mt-5 max-w-xl text-sm leading-7 text-white/70">
            DealsRky publishes curated product pages and routes buyers to Amazon for
            final checkout. We do not process payments, hold inventory, or manage
            order fulfillment.
          </p>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-white/75">
            <strong className="text-white">Affiliate disclosure:</strong> As an
            Amazon Associate, we earn from qualifying purchases. Product prices and
            availability are shown on Amazon and may change at any time.
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-white/45">
            Explore
          </h2>
          <div className="mt-5 flex flex-col gap-3 text-sm text-white/75">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <Link to="/deals" className="hover:text-white">
              Browse Deals
            </Link>
            <Link to="/blog" className="hover:text-white">
              Blog
            </Link>
            <Link to="/about" className="hover:text-white">
              About
            </Link>
            <Link to="/contact" className="hover:text-white">
              Contact
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-white/45">
            Policies
          </h2>
          <div className="mt-5 flex flex-col gap-3 text-sm text-white/75">
            <Link to="/disclosure" className="hover:text-white">
              Affiliate Disclosure
            </Link>
            <Link to="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
            <Link to="/contact" className="hover:text-white">
              Contact Support
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <p>© {new Date().getFullYear()} DealsRky. All rights reserved.</p>
          <p>Amazon checkout, pricing, inventory, and fulfillment are handled by Amazon.</p>
        </div>
      </div>
    </footer>
  );
}
