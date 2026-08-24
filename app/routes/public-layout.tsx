import { Outlet, useLoaderData } from "react-router";
import type { Route } from "./+types/public-layout";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { PublicAds, PublicAdsBodyEnd } from "../components/PublicAds";
import {
  getSocialLinksSettings,
  toPublicSocialLinks,
} from "../../server/services/social-links";
import type { PublicLayoutLoaderData } from "../utils/social-links";

export async function loader({ context }: Route.LoaderArgs) {
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

export default function PublicLayout() {
  const data = (useLoaderData() ?? {}) as Partial<PublicLayoutLoaderData>;
  const socialLinks = data.socialLinks ?? null;
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <PublicAds />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer socialLinks={socialLinks} />
      <PublicAdsBodyEnd />
    </div>
  );
}
