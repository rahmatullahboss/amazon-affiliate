import { useEffect, useState } from "react";
import { isNativeCapacitorApp } from "../utils/native-auth";
import {
  REVBID_CONTAINER_ID,
  REVBID_PLACEMENT_ID,
  REVBID_SCRIPT_SRC,
  isRevBidScriptSource,
  shouldEnablePublicAds,
} from "../utils/public-ads";

export {
  REVBID_CONTAINER_ID,
  REVBID_PLACEMENT_ID,
  REVBID_SCRIPT_SRC,
  isRevBidScriptSource,
  shouldEnablePublicAds,
} from "../utils/public-ads";

function usePublicAdsEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(shouldEnablePublicAds(isNativeCapacitorApp()));
  }, []);

  return enabled;
}

function ensureRevBidScript() {
  const existingScript = Array.from(document.head.querySelectorAll("script")).find(
    (script) => isRevBidScriptSource(script.getAttribute("src") ?? script.src)
  );

  if (existingScript) {
    return;
  }

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.async = true;
  script.src = REVBID_SCRIPT_SRC;
  document.head.appendChild(script);
}

export function PublicAds() {
  const enabled = usePublicAdsEnabled();

  useEffect(() => {
    if (enabled) {
      ensureRevBidScript();
    }
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div
      data-placement-id={REVBID_PLACEMENT_ID}
      id={REVBID_CONTAINER_ID}
      style={{ minWidth: 300, minHeight: 100, textAlign: "center" }}
    />
  );
}
