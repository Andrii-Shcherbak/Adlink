import "dotenv/config";
import { createApp } from "./app";
import { setupVite, serveStatic, log } from "./vite";

(async () => {
  const { app, server } = await createApp();

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serves both the API and the client. Defaults to 5000 (Replit); set PORT to override.
  // reusePort is not supported on Windows, so only enable it elsewhere.
  const port = Number(process.env.PORT) || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    ...(process.platform !== "win32" && { reusePort: true }),
  }, () => {
    log(`serving on port ${port}`);
  });
})();
