import { useEffect } from "react";
import { useLocation } from "react-router";
import { isNativeCapacitorApp } from "../utils/native-auth";
import {
  isMonetizationEligiblePath,
  type PublicMonetizationConfig,
} from "../utils/monetization";

interface MonetizationAdsProps {
  config: PublicMonetizationConfig;
}

const SESSION_KEY = "dealsrky:monetization:injected:v2";
const SCRIPT_DATA_ATTRIBUTE = "data-dealsrky-monetization";
const SCRIPT_SELECTOR = `script[${SCRIPT_DATA_ATTRIBUTE}]`;

function hasClaimedSession(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    // Fail closed when tab-scoped storage cannot enforce the one-injection cap.
    return true;
  }
}

function claimSession(): boolean {
  try {
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") {
      return false;
    }

    window.sessionStorage.setItem(SESSION_KEY, "1");
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    // Do not inject if the tab-scoped cap cannot be persisted reliably.
    return false;
  }
}

export function MonetizationAds({ config }: MonetizationAdsProps) {
  const location = useLocation();

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      !config.enabled ||
      !config.provider ||
      config.tagAdapter !== "single-script-src" ||
      !config.scriptUrl ||
      isNativeCapacitorApp() ||
      !isMonetizationEligiblePath(location.pathname)
    ) {
      return;
    }

    const provider = config.provider;
    const scriptUrl = config.scriptUrl;
    if (hasClaimedSession() || document.querySelector(SCRIPT_SELECTOR)) {
      return;
    }

    let timerId: number | null = null;
    let visibilityHandler: (() => void) | null = null;
    let cancelled = false;

    const injectScript = () => {
      if (cancelled || document.querySelector(SCRIPT_SELECTOR) || !claimSession()) {
        return;
      }

      const script = document.createElement("script");
      script.src = scriptUrl;
      script.setAttribute(SCRIPT_DATA_ATTRIBUTE, provider);
      script.setAttribute("data-dealsrky-placement", "single-session-public");

      script.addEventListener(
        "error",
        () => {
          // Keep the tab-scoped claim even on network failure: a later route must
          // not turn a failed first attempt into a second ad injection attempt.
          script.remove();
        },
        { once: true }
      );

      // Monetag documents Vignette tags for the document head. Adsterra Social
      // Bar tags are normally placed near the end of body. We preserve that
      // placement while still applying DealsRky's delayed/session safety gate.
      const parent = provider === "monetag" ? document.head : document.body;
      parent.appendChild(script);
    };

    const loadWhenVisible = () => {
      if (document.visibilityState === "hidden") {
        visibilityHandler = () => {
          if (document.visibilityState !== "hidden") {
            if (visibilityHandler) {
              document.removeEventListener("visibilitychange", visibilityHandler);
              visibilityHandler = null;
            }
            injectScript();
          }
        };
        document.addEventListener("visibilitychange", visibilityHandler);
        return;
      }

      injectScript();
    };

    timerId = window.setTimeout(loadWhenVisible, config.loadDelayMs);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      if (visibilityHandler) {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    };
  }, [
    config.enabled,
    config.loadDelayMs,
    config.provider,
    config.scriptUrl,
    config.tagAdapter,
    location.pathname,
  ]);

  return null;
}
