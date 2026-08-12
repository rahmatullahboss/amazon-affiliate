import { Outlet, useLoaderData } from "react-router";
import type { Route } from "./+types/public-layout";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { MonetizationAds } from "../components/MonetizationAds";
import {
  getSocialLinksSettings,
  toPublicSocialLinks,
} from "../../server/services/social-links";
import { buildPublicMonetizationConfig } from "../utils/monetization";
import type { PublicLayoutLoaderData } from "../utils/social-links";

export async function loader({ context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const monetization = buildPublicMonetizationConfig(env);

  if (!env?.DB) {
    return { socialLinks: null, monetization } satisfies PublicLayoutLoaderData;
  }

  try {
    const settings = await getSocialLinksSettings(env.DB);
    return {
      socialLinks: toPublicSocialLinks(settings),
      monetization,
    } satisfies PublicLayoutLoaderData;
  } catch {
    return { socialLinks: null, monetization } satisfies PublicLayoutLoaderData;
  }
}

export default function PublicLayout() {
  const data = (useLoaderData() ?? {}) as Partial<PublicLayoutLoaderData>;
  const socialLinks = data.socialLinks ?? null;
  const monetization =
    data.monetization ?? buildPublicMonetizationConfig({});

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <MonetizationAds config={monetization} />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer socialLinks={socialLinks} />
    </div>
  );
}
