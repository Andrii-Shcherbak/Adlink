import assert from "node:assert/strict";
import test from "node:test";
import { isLikelyBot, isLocalAddress, isNonVisitRequest } from "./click-filters";
import { createPdfAccessToken, verifyPdfAccessToken } from "./pdf-access-token";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

test("real browsers are not bots", () => {
  for (const ua of [CHROME, IPHONE, EDGE]) assert.equal(isLikelyBot(ua), false, ua);
});

test("crawlers, link previews and scripts are bots", () => {
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "WhatsApp/2.23.20.0 A",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5",
    "TelegramBot (like TwitterBot)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    "curl/8.4.0",
    "python-requests/2.31.0",
    "",
    undefined,
  ]) {
    assert.equal(isLikelyBot(ua), true, String(ua));
  }
});

test("prefetches and HEAD requests are not visits", () => {
  assert.equal(isNonVisitRequest("HEAD", {}), true);
  assert.equal(isNonVisitRequest("GET", { "sec-purpose": "prefetch;prerender" }), true);
  assert.equal(isNonVisitRequest("GET", { purpose: "prefetch" }), true);
  assert.equal(isNonVisitRequest("GET", {}), false);
  assert.equal(isNonVisitRequest("POST", { accept: "*/*" }), false);
});

test("local and private network addresses", () => {
  for (const ip of ["127.0.0.1", "::1", "::ffff:127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "fd12::1", "fe80::1", undefined]) {
    assert.equal(isLocalAddress(ip), true, String(ip));
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "94.200.1.1", "2a00:1450:4001::1"]) {
    assert.equal(isLocalAddress(ip), false, ip);
  }
});

test("PDF access tokens are bound to the link and expire", () => {
  const secret = "test-secret";
  const now = 1_700_000_000_000;
  const token = createPdfAccessToken(42, now, secret);

  assert.equal(verifyPdfAccessToken(token, 42, now + 60_000, secret), true);
  assert.equal(verifyPdfAccessToken(token, 43, now, secret), false, "other link");
  assert.equal(verifyPdfAccessToken(token, 42, now + 31 * 60_000, secret), false, "expired");
  assert.equal(verifyPdfAccessToken(token, 42, now, "other-secret"), false, "wrong secret");
});

test("forged or legacy PDF tokens are rejected", () => {
  const secret = "test-secret";
  const now = Date.now();
  const valid = createPdfAccessToken(42, now, secret);
  const tampered = valid.replace(/_(\d+)_42_/, (_m, exp) => `_${Number(exp) + 999999}_42_`);

  for (const token of [
    "pdf_verified_x",
    `pdf_verified_${now}_42`,
    tampered,
    valid.slice(0, -1) + (valid.endsWith("0") ? "1" : "0"),
    undefined,
    ["array"],
  ]) {
    assert.equal(verifyPdfAccessToken(token, 42, now, secret), false, String(token));
  }
});
