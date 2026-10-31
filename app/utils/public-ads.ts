export const REVBID_SCRIPT_SRC = "//prebid.revbid.net/20525/revbid.js";
export const REVBID_PLACEMENT_ID = "revbid-mobile";
export const REVBID_CONTAINER_ID = "revbid-mobile-3617";

export function isRevBidScriptSource(src: string): boolean {
  const normalizedSrc = src.startsWith("//") ? `https:${src}` : src;
  return normalizedSrc === "https://prebid.revbid.net/20525/revbid.js";
}

export function shouldEnablePublicAds(isNativeApp: boolean): boolean {
  return !isNativeApp;
}
