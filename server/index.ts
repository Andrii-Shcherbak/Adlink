import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Set up Vite middleware first
  if (app.get("env") === "development") {
    await setupVite(app);
  } else {
    serveStatic(app);
  }

  // Then set up all the API routes
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Catch-all route for client-side routing
  app.get("*", (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Skip direct URL shortener access
    if (req.path.length <= 8 && req.path !== "/") { // Simple heuristic for shortcodes
      return next();
    }

    // Serve the frontend app
    if (app.get("env") === "development") {
      res.sendFile(path.resolve("client", "index.html"));
    } else {
      res.sendFile(path.resolve("dist", "client", "index.html"));
    }
  });

  // Start the server
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();