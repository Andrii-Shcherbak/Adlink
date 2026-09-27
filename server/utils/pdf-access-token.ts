/**
 * Short-lived signed tokens that let a visitor who entered the right password
 * open a protected PDF link's viewer page.
 */
import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const TOKEN_PATTERN = /^pdf_verified_(\d+)_(\d+)_([a-f0-9]{64})$/;

function sign(urlId: number, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`pdf-access:${urlId}:${expiresAt}`).digest("hex");
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

export function createPdfAccessToken(urlId: number, now = Date.now(), secret = getSecret()): string {
  const expiresAt = now + TOKEN_TTL_MS;
  return `pdf_verified_${expiresAt}_${urlId}_${sign(urlId, expiresAt, secret)}`;
}

export function verifyPdfAccessToken(
  token: unknown,
  urlId: number,
  now = Date.now(),
  secret = process.env.SESSION_SECRET,
): boolean {
  if (typeof token !== "string" || !secret) return false;
  const match = TOKEN_PATTERN.exec(token);
  if (!match) return false;

  const expiresAt = Number(match[1]);
  if (Number(match[2]) !== urlId || expiresAt < now) return false;

  const expected = Buffer.from(sign(urlId, expiresAt, secret), "hex");
  const actual = Buffer.from(match[3], "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
