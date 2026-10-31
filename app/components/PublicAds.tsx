import { useEffect } from "react";
import { useLocation } from "react-router";
import { isNativeCapacitorApp } from "../utils/native-auth";
import {
  ADSTERRA_SOCIAL_BAR_SCRIPT_SRC,
  canLoadAdAt,
  isEligiblePublicAdPath,
  shouldEnablePublicAds,
} from "../utils/public-ads";

// Shared across tabs, refreshes and client-side navigations (not per URL).
const LAST_SOCIAL_AT_KEY = "dealsrky:adsterra:social-bar:last-shown-v2";

export function PublicAds() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    document.querySelector('script[data-dealsrky-social-bar="1"]')?.remove();

    // Never inject on homepage, native app, private interfaces or redirect routes.
    if (pathname === "/" || !isEligiblePublicAdPath(pathname) || !shouldEnablePublicAds(isNativeCapacitorApp())) {
      return;
    }

    let cancelled = false;
    const insertIfEligible = () => {
      if (cancelled) return;
      try {
        const lastRaw = window.localStorage.getItem(LAST_SOCIAL_AT_KEY);
        const lastAt = lastRaw === null ? null : Number(lastRaw);
        const now = Date.now();
        if (lastAt !== null && !Number.isFinite(lastAt)) return;
        if (!canLoadAdAt(now, lastAt)) return;

        // Reserve the five-minute window before triggering the publisher script.
        window.localStorage.setItem(LAST_SOCIAL_AT_KEY, String(now));
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.async = true;
        script.dataset.dealsrkySocialBar = "1";
        script.setAttribute("data-cfasync", "false");
        script.src = ADSTERRA_SOCIAL_BAR_SCRIPT_SRC;
        document.body.appendChild(script);
      } catch {
        // Fail closed when browser storage is unavailable.
      }
    };

    // Web Locks serialize near-simultaneous visits across tabs when supported.
    // localStorage timestamp also covers refreshes, new tabs and older browsers.
    if (navigator.locks?.request) {
      void navigator.locks.request("dealsrky-adsterra-social-bar", insertIfEligible).catch(() => {});
    } else {
      insertIfEligible();
    }

    return () => {
      cancelled = true;
      document.querySelector('script[data-dealsrky-social-bar="1"]')?.remove();
    };
  }, [pathname, search]);

  return null;
}
