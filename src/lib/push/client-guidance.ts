/**
 * Short copy + platform hints for Web Push setup.
 * Kept free of React so unit tests can cover the wording paths.
 */

export type PushClientPlatform =
  "mac" | "windows" | "ios" | "android" | "other";

export type PushBrowserFamily =
  "chrome" | "edge" | "firefox" | "safari" | "brave" | "other";

export function detectPushPlatform(
  userAgent: string,
  platform = "",
): PushClientPlatform {
  const ua = userAgent.toLowerCase();
  const p = platform.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (p.includes("mac") || /macintosh|mac os x/.test(ua)) return "mac";
  if (p.includes("win") || /windows/.test(ua)) return "windows";
  return "other";
}

export function detectPushBrowser(userAgent: string): PushBrowserFamily {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("brave")) return "brave";
  if (ua.includes("firefox/")) return "firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "safari";
  if (ua.includes("chrome/") || ua.includes("crios/")) return "chrome";
  return "other";
}

export function pushBrowserLabel(browser: PushBrowserFamily): string {
  switch (browser) {
    case "chrome":
      return "Google Chrome";
    case "edge":
      return "Microsoft Edge";
    case "firefox":
      return "Firefox";
    case "safari":
      return "Safari";
    case "brave":
      return "Brave";
    default:
      return "your browser";
  }
}

/** One-line OS fix when site permission is granted but banners never appear. */
export function pushOsBlockedHint(
  platform: PushClientPlatform,
  browser: PushBrowserFamily,
): string {
  const app = pushBrowserLabel(browser);
  if (platform === "mac") {
    return `macOS may be blocking ${app}. System Settings → Notifications → ${app} → Allow Notifications. Also turn Focus off.`;
  }
  if (platform === "windows") {
    return `Windows may be blocking ${app}. Settings → System → Notifications → allow ${app}.`;
  }
  if (platform === "ios") {
    return "On iPhone/iPad, add this site to the Home Screen and allow notifications when prompted.";
  }
  if (platform === "android") {
    return `Check Android notification settings for ${app} and this site.`;
  }
  return `Check your system notification settings for ${app}.`;
}

export function pushSiteBlockedHint(browser: PushBrowserFamily): string {
  const app = pushBrowserLabel(browser);
  return `Notifications are blocked for this site in ${app}. Click the lock icon next to the URL → Notifications → Allow, then try again.`;
}
