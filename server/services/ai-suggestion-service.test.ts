import assert from "node:assert/strict";
import test from "node:test";
import { GoogleGenAI } from "@google/genai";
import { AISuggestionError, AISuggestionService } from "./ai-suggestion-service";

function serviceReturning(text: string | undefined): AISuggestionService {
  return new AISuggestionService(
    () =>
      ({
        models: {
          generateContent: async () => ({ text }),
        },
      }) as unknown as GoogleGenAI,
  );
}

test("generates a non-empty title", async () => {
  const service = serviceReturning("  A useful link title  ");

  assert.equal(
    await service.generateTitle({ url: "https://example.com" }),
    "A useful link title",
  );
});

test("rejects an empty title instead of returning a fake fallback", async () => {
  const service = serviceReturning("  ");

  await assert.rejects(
    service.generateTitle({ url: "https://example.com" }),
    (error: unknown) =>
      error instanceof AISuggestionError &&
      error.statusCode === 502 &&
      error.message.includes("empty title"),
  );
});

test("returns only unique, valid shortcode suggestions", async () => {
  const service = serviceReturning(
    JSON.stringify({
      shortcodes: ["Launch-News", "bad!", "launch-news", "3fast", "-broken"],
    }),
  );

  assert.deepEqual(
    await service.generateShortcodeSuggestions({
      url: "https://example.com",
      count: 5,
    }),
    ["launch-news", "3fast"],
  );
});

test("rejects malformed shortcode responses", async () => {
  const service = serviceReturning("not json");

  await assert.rejects(
    service.generateShortcodeSuggestions({ url: "https://example.com" }),
    (error: unknown) =>
      error instanceof AISuggestionError &&
      error.statusCode === 502 &&
      error.message.includes("unreadable"),
  );
});

test("explains provider quota exhaustion without exposing provider payloads", async () => {
  const service = new AISuggestionService(
    () =>
      ({
        models: {
          generateContent: async () => {
            throw Object.assign(new Error("private provider response"), {
              status: 429,
              code: "RESOURCE_EXHAUSTED",
            });
          },
        },
      }) as unknown as GoogleGenAI,
  );

  await assert.rejects(
    service.generateTitle({ url: "https://example.com" }),
    (error: unknown) =>
      error instanceof AISuggestionError &&
      error.statusCode === 429 &&
      error.message.includes("quota") &&
      !error.message.includes("private provider response"),
  );
});

test("reports missing managed AI configuration clearly", async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    const service = new AISuggestionService();
    await assert.rejects(
      service.generateTitle({ url: "https://example.com" }),
      (error: unknown) =>
        error instanceof AISuggestionError &&
        error.statusCode === 503 &&
        error.message.includes("GEMINI_API_KEY"),
    );
  } finally {
    if (originalKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalKey;
    }
  }
});