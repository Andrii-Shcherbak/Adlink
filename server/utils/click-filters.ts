/**
 * Decides which link visits count as real clicks in analytics.
 */

// Crawlers, link-preview fetchers, security scanners and scripted clients.
// Real browsers opening a link from these apps use a normal browser user agent.
const BOT_PATTERN = new RegExp(
  [
    "bot\\b", "bot/", "crawl", "spider", "slurp", "scanner", "headless", "lighthouse",
    "facebookexternalhit", "embedly", "quora link preview", "skypeuripreview", "bingpreview",
    "whatsapp", "telegram", "slack", "discord", "vkshare", "pinterest", "redditbot",
    "google-inspectiontool", "google-safety", "googleother", "feedfetcher", "apis-google",
    "microsoft office", "ms-office", "outlook-", "proofpoint", "mimecast", "barracuda",
    "pingdom", "uptime", "statuscake", "linkcheck", "validator",
    "curl/", "wget/", "python-requests", "python-urllib", "aiohttp", "httpx", "axios/",
    "node-fetch", "undici", "go-http-client", "java/", "okhttp", "libwww", "postman",
  ].join("|"),
  "i",
);

export function isLikelyBot(userAgent: string | undefined): boolean {
  // Browsers always send a user agent; its absence means a script
  if (!userAgent || !userAgent.trim()) return true;
  return BOT_PATTERN.test(userAgent);
}

type HeaderValue = string | string[] | undefined;

/** Speculative loads (browser prefetch/prerender) and HEAD checks aren't visits. */
export function isNonVisitRequest(method: string, headers: Record<string, HeaderValue>): boolean {
  if (method.toUpperCase() === "HEAD") return true;
  const purpose = [headers["sec-purpose"], headers["purpose"], headers["x-purpose"], headers["x-moz"]]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /prefetch|prerender|preview/.test(purpose);
}

/** Loopback and private-network addresses: local development, not real visitors. */
export function isLocalAddress(ip: string | undefined): boolean {
  if (!ip) return true;
  const address = ip.trim().toLowerCase().replace(/^::ffff:/, "");
  if (address === "::1" || address === "localhost") return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(address)) return true;
  const match = /^172\.(\d+)\./.exec(address);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
  return /^(f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/.test(address);
}
