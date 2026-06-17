import { Link } from "react-router";
import { BROWSE_PICKS_LABEL } from "../utils/affiliate-copy";
import type { PublicSocialLinks } from "../utils/social-links";

const TELEGRAM_PATH =
  "M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19l-9.49 5.99-4.1-1.27c-.88-.25-.89-.86.2-1.27l16.04-6.18c.73-.33 1.43.18 1.15 1.31l-2.73 12.86c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z";

const WHATSAPP_PATH =
  "M19.11 17.21c-.31-.16-1.83-.9-2.11-1s-.49-.16-.7.16-.8 1-1 1.21-.37.24-.68.08a8.45 8.45 0 0 1-2.49-1.54 9.4 9.4 0 0 1-1.72-2.13c-.18-.31 0-.48.13-.63s.31-.37.47-.55.21-.32.31-.53.05-.4-.08-.55-.7-1.69-1-2.31-.52-.55-.71-.56h-.61a1.17 1.17 0 0 0-.85.4 3.55 3.55 0 0 0-1.11 2.65 6.16 6.16 0 0 0 1.29 3.27 14.14 14.14 0 0 0 5.42 4.78c.76.33 1.35.52 1.81.67a4.36 4.36 0 0 0 2 .12 3.27 3.27 0 0 0 2.14-1.51 2.65 2.65 0 0 0 .19-1.51c-.08-.14-.28-.22-.59-.37zM12 2a10 10 0 0 0-8.46 15.32L2 22l4.82-1.26A10 10 0 1 0 12 2z";

const MESSENGER_PATH =
  "M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.34.27.55l.05 1.79c.02.57.61.94 1.13.71l1.99-.94c.16-.08.34-.1.51-.06.91.25 1.88.38 2.91.38 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.13 13.4-2.62-2.78-5.12 2.78 5.62-6 2.67 2.78 5.07-2.78-5.62 6z";

interface FooterProps {
  socialLinks?: PublicSocialLinks | null;
}

export function Footer({ socialLinks }: FooterProps) {
  const items: Array<{
    key: keyof PublicSocialLinks;
    label: string;
    url: string;
    className: string;
    path: string;
  }> = [];

  if (socialLinks?.telegram) {
    items.push({
      key: "telegram",
      label: "Telegram",
      url: socialLinks.telegram.url,
      className: "bg-[#229ED9] hover:opacity-90",
      path: TELEGRAM_PATH,
    });
  }
  if (socialLinks?.whatsapp) {
    items.push({
      key: "whatsapp",
      label: "WhatsApp",
      url: socialLinks.whatsapp.url,
      className: "bg-[#25D366] hover:opacity-90",
      path: WHATSAPP_PATH,
    });
  }
  if (socialLinks?.messenger) {
    items.push({
      key: "messenger",
      label: "Messenger",
      url: socialLinks.messenger.url,
      className: "bg-gradient-to-br from-[#00B2FF] to-[#006AFF] hover:opacity-90",
      path: MESSENGER_PATH,
    });
  }

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
                Curated Product Picks
              </p>
            </div>
          </div>

          <p className="mt-5 max-w-xl text-sm leading-7 text-white/70">
            DealsRky publishes curated product pages and routes visitors to the final
            retailer page for pricing and checkout. We do not process payments, hold
            inventory, or manage order fulfillment.
          </p>

          {items.length > 0 ? (
            <div className="mt-6 flex items-center gap-3" aria-label="Social channels">
              {items.map((item) => (
                <a
                  key={item.key}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity ${item.className}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={item.path} />
                  </svg>
                </a>
              ))}
            </div>
          ) : null}

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-white/75">
            <strong className="text-white">Affiliate disclosure:</strong> As an Amazon Associate, we earn from qualifying purchases. DealsRky may
            earn a commission when you continue through eligible product links and make
            a purchase. Final pricing and availability are always shown on the retailer
            page.
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
              {BROWSE_PICKS_LABEL}
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
            <Link to="/terms" className="hover:text-white">
              Terms of Use
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
          <p>Checkout, pricing, inventory, and fulfillment are handled by the retailer.</p>
        </div>
      </div>
    </footer>
  );
}
