import { Form, Link, useLocation } from "react-router";

const navLinks = [
  { name: "Home", path: "/" },
  { name: "Browse Deals", path: "/deals" },
  { name: "About", path: "/about" },
  { name: "Disclosure", path: "/disclosure" },
  { name: "Contact", path: "/contact" },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="border-b border-gray-100 bg-[#f3f7f7]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <p>
            Curated Amazon affiliate storefront with transparent product pages and
            direct Amazon checkout.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/disclosure" className="font-semibold text-primary hover:text-primary-hover">
              Affiliate disclosure
            </Link>
            <Link to="/privacy" className="hover:text-gray-900">
              Privacy
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-black text-white">
              D
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-gray-950">DealsRky</p>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
                Amazon affiliate hub
              </p>
            </div>
          </Link>

          <Form
            action="/deals"
            method="GET"
            className="flex w-full max-w-2xl items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-2 shadow-sm"
          >
            <input
              type="text"
              name="q"
              placeholder="Search curated products"
              className="w-full bg-transparent px-4 text-sm text-gray-800 outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
            >
              Search
            </button>
          </Form>

          <div className="flex items-center gap-3">
            <Link
              to="/portal/login"
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-primary hover:text-primary"
            >
              Agent portal
            </Link>
            <Link
              to="/admin/login"
              className="rounded-full bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              Admin
            </Link>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4 text-sm font-semibold text-gray-600">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;

            return (
              <Link
                key={link.name}
                to={link.path}
                className={
                  isActive
                    ? "text-primary"
                    : "transition-colors hover:text-gray-900"
                }
              >
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
