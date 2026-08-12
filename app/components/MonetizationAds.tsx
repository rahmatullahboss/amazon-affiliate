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

const SESSION_KEY_PREFIX = "dealsrky:monetization:shown:v1";
const SCRIPT_DATA_ATTRIBUTE = "data-dealsrky-monetization";

function getSessionKey(provider: NonNullable<PublicMonetizationConfig["provider"]>): string {
  return `${SESSION_KEY_PREFIX}:${provider}`;
}

function hasLoadedThisSession(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markLoadedThisSession(key: string): void {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage can be unavailable in privacy-restricted browsers. The DOM marker
    // still prevents duplicate injection during the current document lifetime.
  }
}

function clearLoadedThisSession(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing else to recover when storage is unavailable.
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
      !config.scriptUrl ||
      isNativeCapacitorApp() ||
      !isMonetizationEligiblePath(location.pathname)
    ) {
      return;
    }

    const provider = config.provider;
    const sessionKey = getSessionKey(provider);
    if (hasLoadedThisSession(sessionKey)) {
      return;
    }

    const selector = `script[${SCRIPT_DATA_ATTRIBUTE}="${provider}"]`;
    if (document.querySelector(selector)) {
      return;
    }

    let timerId: number | null = null;
    let visibilityHandler: (() => void) | null = null;
    let cancelled = false;

    const injectScript = () => {
      if (cancelled || hasLoadedThisSession(sessionKey) || document.querySelector(selector)) {
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.src = config.scriptUrl as string;
      script.setAttribute(SCRIPT_DATA_ATTRIBUTE, provider);
      script.setAttribute("data-dealsrky-placement", "single-session-public");

      markLoadedThisSession(sessionKey);
      script.addEventListener(
        "error",
        () => {
          clearLoadedThisSession(sessionKey);
          script.remove();
        },
        { once: true }
      );

      document.body.appendChild(script);
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
  }, [config.enabled, config.loadDelayMs, config.provider, config.scriptUrl, location.pathname]);

  return null;
}
