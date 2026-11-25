import { Outlet, useLoaderData, useLocation, type ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/public-layout";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { PublicAds } from "../components/PublicAds";
import { AdBanner } from "../components/AdBanner";
import { isEligiblePublicAdPath, isProductDetailAdPath } from "../utils/public-ads";
import {
  getSocialLinksSettings,
  toPublicSocialLinks,
} from "../../server/services/social-links";
import type { PublicLayoutLoaderData } from "../utils/social-links";

export async function loader({ context, request }: Route.LoaderArgs) {
  // The homepage intentionally hides footer social links. Avoid that D1
  // read there; crossing the homepage boundary must revalidate the layout.
  if (new URL(request.url).pathname === "/") {
    return { socialLinks: null } satisfies PublicLayoutLoaderData;
  }
  const env = context.cloudflare.env;
  if (!env?.DB) {
    return { socialLinks: null } satisfies PublicLayoutLoaderData;
  }

  try {
    const settings = await getSocialLinksSettings(env.DB);
    return { socialLinks: toPublicSocialLinks(settings) } satisfies PublicLayoutLoaderData;
  } catch {
    return { socialLinks: null } satisfies PublicLayoutLoaderData;
  }
}

export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return (currentUrl.pathname === "/") !== (nextUrl.pathname === "/") || defaultShouldRevalidate;
}

export default function PublicLayout() {
  const data = (useLoaderData() ?? {}) as Partial<PublicLayoutLoaderData>;
  const pathname = useLocation().pathname;
  const isHomepage = pathname === "/";
  // On details pages the same primary zone belongs just below the breadcrumb.
  const isProductDetail = isProductDetailAdPath(pathname);
  const socialLinks = isHomepage ? null : data.socialLinks ?? null;
  return (
    <div className="flex flex-col min-h-screen">
      <link rel="preconnect" href="https://www.highrevenueformat.com" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://www.highrevenueformat.com" />
      <Header />
      {isEligiblePublicAdPath(pathname) && !isProductDetail ? <AdBanner placement="public-under-header" /> : null}
      <PublicAds />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer socialLinks={socialLinks} />
    </div>
  );
}
