import { Form, Link, useLoaderData, useLocation } from "react-router";
import { useState } from "react";
import { BROWSE_PICKS_LABEL } from "../utils/affiliate-copy";
import type { PublicLayoutLoaderData } from "../utils/social-links";

const navLinks = [
  { name: "Home", path: "/" },
  { name: BROWSE_PICKS_LABEL, path: "/deals" },
  { name: "Blog", path: "/blog" },
  { name: "Disclosure", path: "/disclosure" },
  { name: "About", path: "/about" },
  { name: "Contact", path: "/contact" },
];

export function Header() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const loaderData = (useLoaderData() ?? {}) as Partial<PublicLayoutLoaderData>;
  const socialLinks = loaderData.socialLinks ?? null;

  return (
    <div className="sticky top-0 z-40 w-full">
      {/* Amazon Affiliate Disclosure Banner */}
      <div className="bg-gray-900 px-4 py-1.5 text-center text-[11px] font-medium text-gray-300 sm:text-xs">
        As an Amazon Associate, we earn from qualifying purchases.{" "}
        <Link to="/disclosure" className="underline hover:text-white">
          Learn more
        </Link>
      </div>
      <header className="bg-white/95 shadow-sm backdrop-blur">
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
                Curated Picks
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
            <SocialIconsInline socialLinks={socialLinks} />
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
            <SocialIconsList
              socialLinks={socialLinks}
              onItemClick={() => setIsMobileMenuOpen(false)}
            />
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
    </div>
  );
}

function SocialIconsInline({ socialLinks }: { socialLinks: PublicLayoutLoaderData["socialLinks"] | null }) {
  if (!socialLinks) return null;
  const items: Array<{ key: keyof PublicSocialLinks; label: string; className: string; path: string }> = [];
  if (socialLinks.telegram) {
    items.push({
      key: "telegram",
      label: "Telegram",
      className: "bg-[#229ED9] text-white hover:opacity-90",
      path: TELEGRAM_PATH,
    });
  }
  if (socialLinks.whatsapp) {
    items.push({
      key: "whatsapp",
      label: "WhatsApp",
      className: "bg-[#25D366] text-white hover:opacity-90",
      path: WHATSAPP_PATH,
    });
  }
  if (socialLinks.messenger) {
    items.push({
      key: "messenger",
      label: "Messenger",
      className: "bg-gradient-to-br from-[#00B2FF] to-[#006AFF] text-white hover:opacity-90",
      path: MESSENGER_PATH,
    });
  }
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5" aria-label="Social channels">
      {items.map((item) => (
        <a
          key={item.key}
          href={socialLinks[item.key]!.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.label}
          title={item.label}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-opacity ${item.className}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={item.path} />
          </svg>
        </a>
      ))}
    </div>
  );
}

function SocialIconsList({
  socialLinks,
  onItemClick,
}: {
  socialLinks: PublicLayoutLoaderData["socialLinks"] | null;
  onItemClick: () => void;
}) {
  if (!socialLinks) return null;
  const items: Array<{ key: keyof PublicSocialLinks; label: string; className: string; path: string }> = [];
  if (socialLinks.telegram) {
    items.push({
      key: "telegram",
      label: "Join us on Telegram",
      className: "bg-[#229ED9] text-white",
      path: TELEGRAM_PATH,
    });
  }
  if (socialLinks.whatsapp) {
    items.push({
      key: "whatsapp",
      label: "Chat on WhatsApp",
      className: "bg-[#25D366] text-white",
      path: WHATSAPP_PATH,
    });
  }
  if (socialLinks.messenger) {
    items.push({
      key: "messenger",
      label: "Message on Messenger",
      className: "bg-gradient-to-br from-[#00B2FF] to-[#006AFF] text-white",
      path: MESSENGER_PATH,
    });
  }
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <a
          key={item.key}
          href={socialLinks[item.key]!.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onItemClick}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${item.className}`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={item.path} />
            </svg>
          </span>
          {item.label}
        </a>
      ))}
    </div>
  );
}

const TELEGRAM_PATH =
  "M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19l-9.49 5.99-4.1-1.27c-.88-.25-.89-.86.2-1.27l16.04-6.18c.73-.33 1.43.18 1.15 1.31l-2.73 12.86c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z";

const WHATSAPP_PATH =
  "M19.11 17.21c-.31-.16-1.83-.9-2.11-1s-.49-.16-.7.16-.8 1-1 1.21-.37.24-.68.08a8.45 8.45 0 0 1-2.49-1.54 9.4 9.4 0 0 1-1.72-2.13c-.18-.31 0-.48.13-.63s.31-.37.47-.55.21-.32.31-.53.05-.4-.08-.55-.7-1.69-1-2.31-.52-.55-.71-.56h-.61a1.17 1.17 0 0 0-.85.4 3.55 3.55 0 0 0-1.11 2.65 6.16 6.16 0 0 0 1.29 3.27 14.14 14.14 0 0 0 5.42 4.78c.76.33 1.35.52 1.81.67a4.36 4.36 0 0 0 2 .12 3.27 3.27 0 0 0 2.14-1.51 2.65 2.65 0 0 0 .19-1.51c-.08-.14-.28-.22-.59-.37zM12 2a10 10 0 0 0-8.46 15.32L2 22l4.82-1.26A10 10 0 1 0 12 2z";

const MESSENGER_PATH =
  "M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.34.27.55l.05 1.79c.02.57.61.94 1.13.71l1.99-.94c.16-.08.34-.1.51-.06.91.25 1.88.38 2.91.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.13 13.4-2.62-2.78-5.12 2.78 5.62-6 2.67 2.78 5.07-2.78-5.62 6z";

type PublicSocialLinks = NonNullable<PublicLayoutLoaderData["socialLinks"]>;
