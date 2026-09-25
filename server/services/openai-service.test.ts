import assert from "node:assert/strict";
import test from "node:test";
import OpenAI from "openai";
import { AISuggestionError, OpenAIService } from "./openai-service";

function serviceReturning(content: string | null): OpenAIService {
  return new OpenAIService(
    () =>
      ({
        chat: {
          completions: {
            create: async () => ({
              choices: [{ message: { content } }],
            }),
          },
        },
      }) as unknown as OpenAI,
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
  const service = new OpenAIService(
    () =>
      ({
        chat: {
          completions: {
            create: async () => {
              throw Object.assign(new Error("private provider response"), {
                status: 429,
                code: "credit_balance_exhausted",
                type: "insufficient_quota",
                request_id: "test-request",
              });
            },
          },
        },
      }) as unknown as OpenAI,
  );

  await assert.rejects(
    service.generateTitle({ url: "https://example.com" }),
    (error: unknown) =>
      error instanceof AISuggestionError &&
      error.statusCode === 503 &&
      error.message.includes("no credits") &&
      !error.message.includes("private provider response"),
  );
});

test("reports missing AI configuration clearly", async () => {
  process.env.OPENAI_API_KEY = "";
  const service = new OpenAIService();

  await assert.rejects(
    service.generateTitle({ url: "https://example.com" }),
    (error: unknown) =>
      error instanceof AISuggestionError &&
      error.statusCode === 503 &&
      error.message.includes("not configured"),
  );
});