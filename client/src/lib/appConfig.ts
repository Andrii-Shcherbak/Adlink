// Base URL for short links and QR codes. Set VITE_APP_URL (e.g. https://adlink.dcxtransform.com)
// so links stay on the public domain even when the app is opened from localhost or a preview URL.
export function getAppUrl(): string {
  const appUrl = import.meta.env.VITE_APP_URL?.trim();
  if (appUrl) {
    return appUrl.replace(/\/+$/, "");
  }

  return window.location.origin;
}
