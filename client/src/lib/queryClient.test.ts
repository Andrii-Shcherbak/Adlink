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
async function captureRequest(call: () => Promise<unknown>): Promise<RequestInit> {
  const originalFetch = globalThis.fetch;
  let captured: RequestInit | undefined;
  globalThis.fetch = async (_url, init) => {
    captured = init;
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await call();
  } finally {
    globalThis.fetch = originalFetch;
  }
  return captured!;
}

test("apiRequest sends a JSON content type for string bodies without headers", async () => {
  const init = await captureRequest(() =>
    apiRequest("/api/assets/files/1", { method: "PATCH", body: JSON.stringify({ folderId: 2 }) }),
  );

  assert.deepEqual(init.headers, { "Content-Type": "application/json" });
  assert.equal(init.body, '{"folderId":2}');
});

test("apiRequest keeps an explicit content type", async () => {
  const init = await captureRequest(() =>
    apiRequest("/api/x", { method: "POST", body: "a=1", headers: { "content-type": "text/plain" } }),
  );

  assert.deepEqual(init.headers, { "content-type": "text/plain" });
});

test("apiRequest leaves FormData uploads to the browser", async () => {
  const form = new FormData();
  form.append("name", "file");
  const init = await captureRequest(() =>
    apiRequest("/api/assets/files", { method: "POST", body: form, customConfig: { isFormData: true } }),
  );

  assert.equal(init.body, form);
  assert.equal(init.headers, undefined);
  assert.equal("customConfig" in init, false);
});
