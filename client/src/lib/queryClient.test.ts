import assert from "node:assert/strict";
import test from "node:test";
import { apiRequest } from "./queryClient";

test("apiRequest exposes the server's readable AI error message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error:
          "AI suggestions are unavailable because the AI provider account has no credits.",
      }),
      {
        status: 503,
        headers: { "content-type": "application/json" },
      },
    );

  try {
    await assert.rejects(
      apiRequest("/api/ai/generate-title", { method: "POST" }),
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          "503: AI suggestions are unavailable because the AI provider account has no credits.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});