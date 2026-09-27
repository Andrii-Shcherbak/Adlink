/**
 * Vercel serverless entry point. Static client files are served by Vercel's CDN;
 * this function handles the API, short-link redirects and client-side routes.
 * Built by scripts/build-vercel.mjs.
 */
import type { IncomingMessage, ServerResponse } from "http";
import { fileURLToPath } from "url";
import { createApp } from "./app";

// The bundle lives at dist/vercel/index.mjs, next to the built client in dist/public
const indexHtml = fileURLToPath(new URL("../public/index.html", import.meta.url));

const appPromise = createApp().then(({ app }) => {
  // Anything the routes didn't handle is a client-side route
  app.use("*", (_req, res) => {
    res.sendFile(indexHtml);
  });
  return app;
});

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await appPromise;
  app(req as any, res as any);
}
