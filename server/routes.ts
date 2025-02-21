import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertUrlSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.post("/api/urls", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parseResult = insertUrlSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    const url = await storage.createUrl(req.user!.id, parseResult.data);
    res.status(201).json(url);
  });

  app.get("/api/urls", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const urls = await storage.getUserUrls(req.user!.id);
    res.json(urls);
  });

  app.get("/api/r/:shortCode", async (req, res) => {
    const url = await storage.getUrlByShortCode(req.params.shortCode);
    if (!url) return res.sendStatus(404);
    
    await storage.incrementUrlClicks(url.id);
    res.redirect(url.originalUrl);
  });

  const httpServer = createServer(app);
  return httpServer;
}
