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

function getReferrer(referer: string | undefined): string {
  if (!referer) return 'direct';
  try {
    const url = new URL(referer);
    return url.hostname;
  } catch {
    return 'invalid';
  }
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const [urls, total] = await Promise.all([
      storage.getUserUrls(req.user!.id, limit, offset),
      storage.getUserUrlsCount(req.user!.id)
    ]);

    res.json({
      urls,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + urls.length < total
      }
    });
  });

  app.get("/api/r/:shortCode", async (req, res) => {
    const url = await storage.getUrlByShortCode(req.params.shortCode);
    if (!url) return res.sendStatus(404);

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);

    // Get country code from headers, default to user's locale if not available
    let countryCode = (req.headers['cf-ipcountry'] as string)?.toUpperCase();
    if (!countryCode) {
      try {
        const acceptLanguage = req.headers['accept-language'] || '';
        const langParts = acceptLanguage.split(',')[0].split('-');
        countryCode = langParts.length > 1 ? langParts[1].toUpperCase() : 'UNKNOWN';
      } catch {
        countryCode = 'UNKNOWN';
      }
    }

    await storage.incrementUrlClicks(url.id, deviceType, countryCode, referrer);
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

  app.delete("/api/urls/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      await storage.deleteUrl(parseInt(req.params.id), req.user!.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete URL" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}