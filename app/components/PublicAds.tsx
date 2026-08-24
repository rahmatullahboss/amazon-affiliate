import { useEffect, useState } from "react";
import { isNativeCapacitorApp } from "../utils/native-auth";
import {
  BOTTOM_SCRIPT_SRC,
  NATIVE_BANNER_CONTAINER_ID,
  NATIVE_BANNER_SCRIPT_SRC,
  POPUNDER_SCRIPT_SRC,
  shouldEnablePublicAds,
} from "../utils/public-ads";

export {
  BOTTOM_SCRIPT_SRC,
  NATIVE_BANNER_CONTAINER_ID,
  NATIVE_BANNER_SCRIPT_SRC,
  POPUNDER_SCRIPT_SRC,
  shouldEnablePublicAds,
} from "../utils/public-ads";

function usePublicAdsEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(shouldEnablePublicAds(isNativeCapacitorApp()));
  }, []);

  return enabled;
}

function ensurePopunderScript() {
  const existingScript = document.head.querySelector(
    `script[src="${POPUNDER_SCRIPT_SRC}"]`
  );

  if (existingScript) {
    return;
  }

  const script = document.createElement("script");
  script.src = POPUNDER_SCRIPT_SRC;
  document.head.appendChild(script);
}

export function PublicAds() {
  const enabled = usePublicAdsEnabled();

  useEffect(() => {
    if (enabled) {
      ensurePopunderScript();
    }
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <script
        async
        data-cfasync="false"
        src={NATIVE_BANNER_SCRIPT_SRC}
      />
      <div id={NATIVE_BANNER_CONTAINER_ID} />
    </>
  );
}

export function PublicAdsBodyEnd() {
  const enabled = usePublicAdsEnabled();

  if (!enabled) {
    return null;
  }

  return <script src={BOTTOM_SCRIPT_SRC} />;
}
