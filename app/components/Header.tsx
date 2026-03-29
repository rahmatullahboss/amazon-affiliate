import { Form, Link, useLocation } from "react-router";
import { useState } from "react";

const navLinks = [
  { name: "Home", path: "/" },
  { name: "Browse Deals", path: "/deals" },
  { name: "Disclosure", path: "/disclosure" },
  { name: "About", path: "/about" },
  { name: "Contact", path: "/contact" },
];

export function Header() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 lg:px-6 lg:py-4">
        {/* Main Desktop & Top Mobile Row */}
        <div className="flex items-center justify-between gap-4">
          
          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-base font-black text-white">
              D
            </div>
            <div className="flex flex-col">
              <p className="text-[17px] font-black leading-none tracking-tight text-gray-950">DealsRky</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 lg:tracking-[0.2em]">
                Amazon Hub
              </p>
            </div>
          </Link>

          {/* Desktop Search */}
          <div className="hidden flex-1 lg:block lg:max-w-xl">
             <Form
              action="/deals"
              method="GET"
              className="group flex w-full items-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 transition-colors focus-within:border-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20"
            >
              <div className="pl-4 text-gray-400 group-focus-within:text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                name="q"
                placeholder="Search curated products..."
                className="w-full bg-transparent px-3 py-2 text-sm font-medium text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400"
              />
              <button
                type="submit"
                className="bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
              >
                Search
              </button>
            </Form>
          </div>

          {/* Desktop Nav & Admin Links */}
          <div className="hidden shrink-0 items-center gap-6 lg:flex">
            <nav className="flex items-center gap-5 text-sm font-semibold text-gray-600">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className={location.pathname === link.path ? "text-primary" : "transition-colors hover:text-gray-950"}
                >
                  {link.name}
                </Link>
              ))}
            </nav>
            <div className="h-4 w-px bg-gray-200"></div>
            <div className="flex items-center gap-3 text-sm">
              <Link to="/portal/login" className="font-medium text-gray-500 transition-colors hover:text-gray-900">
                Agent Login
              </Link>
              <Link
                to="/admin/login"
                className="rounded-full bg-gray-100 px-3 py-1.5 font-bold text-gray-700 transition-colors hover:bg-gray-200"
              >
                Admin
              </Link>
            </div>
          </div>

          {/* Mobile Right: Search / Hamburger Toggle */}
          <div className="flex flex-1 items-center justify-end gap-2 lg:hidden">
            {/* Mobile Search Input (compact) */}
            <Form
              action="/deals"
              method="GET"
              className="flex max-w-[180px] flex-1 items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 focus-within:border-primary focus-within:bg-white"
            >
              <input
                type="text"
                name="q"
                placeholder="Search..."
                className="w-full min-w-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              />
              <button type="submit" className="text-gray-400" aria-label="Search">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </Form>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute left-0 top-full w-full border-b border-gray-100 bg-white px-4 py-4 shadow-lg lg:hidden">
          <nav className="flex flex-col gap-4 text-[15px] font-bold text-gray-700">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={location.pathname === link.path ? "text-primary" : "hover:text-gray-950"}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className="my-1 h-px w-full bg-gray-100"></div>
            <Link to="/portal/login" className="flex items-center gap-2 font-semibold text-gray-500 hover:text-gray-900" onClick={() => setIsMobileMenuOpen(false)}>
              Agent Portal
            </Link>
            <Link to="/admin/login" className="flex items-center gap-2 font-semibold text-gray-500 hover:text-gray-900" onClick={() => setIsMobileMenuOpen(false)}>
              Admin Access
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
