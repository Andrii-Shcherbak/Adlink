import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertUrlSchema } from "@shared/schema";
import { qrConfigSchema } from "@shared/schema";
import { UAParser } from "ua-parser-js";

function getDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();

  if (device.type === 'tablet') return 'tablet';
  if (device.type === 'mobile') return 'mobile';
  return 'desktop';
}

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

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const countryCode = (req.headers['cf-ipcountry'] as string || 'US').toUpperCase();

    await storage.incrementUrlClicks(url.id, deviceType, countryCode);
    res.redirect(url.originalUrl);
  });

  app.patch("/api/urls/:id/qr-config", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parseResult = qrConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    const url = await storage.updateUrlQrConfig(
      parseInt(req.params.id),
      req.user!.id,
      parseResult.data
    );

    if (!url) {
      return res.status(404).send("URL not found");
    }

    res.json(url);
  });

  const httpServer = createServer(app);
  return httpServer;
}