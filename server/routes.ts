import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertUrlSchema } from "@shared/schema";
import { qrConfigSchema } from "@shared/schema";
import { UAParser } from "ua-parser-js";
import { scrypt, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";
import { openAiService } from "./services/openai-service";

const scryptAsync = promisify(scrypt);

async function comparePasswords(supplied: string, stored: string) {
  try {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.post("/api/urls", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parseResult = insertUrlSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    const urlData = {
      ...parseResult.data,
      isPasswordProtected: !!parseResult.data.password,
      password: parseResult.data.password
        ? await hashPassword(parseResult.data.password)
        : undefined
    };

    // Create the URL
    const url = await storage.createUrl(req.user!.id, urlData);

    // Log activity 
    await storage.logActivity({
      userId: req.user!.id,
      type: "url_created",
      metadata: {
        urlId: url.id,
        originalUrl: url.originalUrl,
        shortCode: url.shortCode
      }
    });

    // Generate a title asynchronously - don't block the response
    try {
      const title = await openAiService.generateTitle({ url: url.originalUrl });
      if (title) {
        await storage.updateUrl(url.id, req.user!.id, { title });
      }
    } catch (error) {
      console.error("Error generating title for new URL:", error);
      // Don't block the response or fail if title generation fails
    }

    res.status(201).json(url);
  });

  app.delete("/api/urls/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // First get the URL details to verify ownership and for logging
      const urlId = parseInt(req.params.id);
      const urls = await storage.getUserUrls(req.user!.id, 1, 0);
      const url = urls.find(u => u.id === urlId);

      if (!url || url.userId !== req.user!.id) {
        return res.status(404).send("URL not found");
      }

      await storage.deleteUrl(urlId, req.user!.id);

      // Log URL deletion activity
      await storage.logActivity({
        userId: req.user!.id,
        type: "url_deleted",
        metadata: {
          urlId: url.id,
          originalUrl: url.originalUrl,
          shortCode: url.shortCode
        }
      });

      res.sendStatus(200);
    } catch (error) {
      console.error('Error deleting URL:', error);
      res.status(500).json({ error: "Failed to delete URL" });
    }
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

  // New direct shortCode route without /api/r prefix
  app.get("/:shortCode", async (req, res, next) => {
    // Skip API endpoints and protected route
    if (req.params.shortCode.startsWith('api') || 
        req.params.shortCode === 'protected' || 
        req.params.shortCode === 'admin' || 
        req.params.shortCode === 'analytics' || 
        req.params.shortCode === 'profile' || 
        req.params.shortCode === 'activities') {
      return next();
    }
    
    const url = await storage.getUrlByShortCode(req.params.shortCode);
    if (!url) return next();

    if (url.isPasswordProtected) {
      return res.redirect(`/protected/${url.shortCode}`);
    }

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    let countryCode = (req.headers['cf-ipcountry'] as string)?.toUpperCase() || 'UNKNOWN';

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryCode, referrer);
      res.redirect(url.originalUrl);
    } catch (error) {
      console.error('Error incrementing clicks:', error);
      res.redirect(url.originalUrl);
    }
  });

  // Keep the /api/r/:shortCode route for backward compatibility
  app.get("/api/r/:shortCode", async (req, res) => {
    const url = await storage.getUrlByShortCode(req.params.shortCode);
    if (!url) return res.sendStatus(404);

    if (url.isPasswordProtected) {
      return res.redirect(`/protected/${url.shortCode}`);
    }

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    let countryCode = (req.headers['cf-ipcountry'] as string)?.toUpperCase() || 'UNKNOWN';

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryCode, referrer);
      res.redirect(url.originalUrl);
    } catch (error) {
      console.error('Error incrementing clicks:', error);
      res.redirect(url.originalUrl);
    }
  });

  app.post("/:shortCode/verify", async (req, res) => {
    const url = await storage.getUrlByShortCode(req.params.shortCode);
    if (!url) return res.sendStatus(404);

    if (!url.isPasswordProtected || !url.password) {
      return res.status(400).json({ error: "URL is not password protected" });
    }

    const isValid = await comparePasswords(req.body.password, url.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    let countryCode = (req.headers['cf-ipcountry'] as string)?.toUpperCase() || 'UNKNOWN';

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryCode, referrer);
      res.json({ redirectUrl: url.originalUrl });
    } catch (error) {
      console.error('Error incrementing clicks:', error);
      res.json({ redirectUrl: url.originalUrl });
    }
  });

  // Keep old route for backward compatibility
  app.post("/api/r/:shortCode/verify", async (req, res) => {
    const url = await storage.getUrlByShortCode(req.params.shortCode);
    if (!url) return res.sendStatus(404);

    if (!url.isPasswordProtected || !url.password) {
      return res.status(400).json({ error: "URL is not password protected" });
    }

    const isValid = await comparePasswords(req.body.password, url.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    let countryCode = (req.headers['cf-ipcountry'] as string)?.toUpperCase() || 'UNKNOWN';

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryCode, referrer);
      res.json({ redirectUrl: url.originalUrl });
    } catch (error) {
      console.error('Error incrementing clicks:', error);
      res.json({ redirectUrl: url.originalUrl });
    }
  });

  app.patch("/api/urls/:id/qr-config", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parseResult = qrConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    const url = await storage.getUrlByShortCode(req.params.id, req.user!.id);
    if (!url) {
      return res.status(404).send("URL not found");
    }

    const updatedUrl = await storage.updateUrlQrConfig(
      parseInt(req.params.id),
      req.user!.id,
      parseResult.data
    );

    res.json(updatedUrl);
  });

  app.patch("/api/urls/:id/password", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { password } = req.body;

    try {
      // Verify the URL belongs to the current user
      const urlId = parseInt(req.params.id);
      const urls = await storage.getUserUrls(req.user!.id, 1, 0);
      const url = urls.find(u => u.id === urlId);
      if (!url) {
        return res.status(404).send("URL not found");
      }

      // Update URL with new password settings
      const updatedUrl = await storage.updateUrl(urlId, req.user!.id, {
        password: password ? await hashPassword(password) : null,
        isPasswordProtected: !!password
      });

      // Log password protection change
      await storage.logActivity({
        userId: req.user!.id,
        type: "url_password_update",
        metadata: {
          urlId: updatedUrl.id,
          action: password ? "added_or_updated" : "removed"
        }
      });

      res.json(updatedUrl);
    } catch (error) {
      console.error('Error updating URL password:', error);
      res.status(500).json({ error: "Failed to update URL password" });
    }
  });

  app.get("/api/activities", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    try {
      const [activities, total] = await Promise.all([
        storage.getAllActivities(limit, offset),
        storage.getAllActivitiesCount()
      ]);

      res.json({
        activities,
        pagination: {
          total,
          page,
          totalPages: Math.ceil(total / limit),
          hasMore: offset + activities.length < total
        }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });
  
  // AI endpoints for title and shortcode generation
  
  app.post("/api/ai/generate-title", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    
    try {
      const title = await openAiService.generateTitle({ url });
      res.json({ title });
    } catch (error) {
      console.error("Error generating title:", error);
      res.status(500).json({ error: "Failed to generate title" });
    }
  });
  
  app.post("/api/ai/generate-shortcodes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { url, title, count = 3 } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    
    try {
      const shortcodes = await openAiService.generateShortcodeSuggestions({ 
        url, 
        title, 
        count: Math.min(5, Math.max(1, count)) // Limit between 1-5
      });
      res.json({ shortcodes });
    } catch (error) {
      console.error("Error generating shortcodes:", error);
      res.status(500).json({ error: "Failed to generate shortcode suggestions" });
    }
  });
  
  // Update title for a URL
  app.patch("/api/urls/:id/title", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }
    
    try {
      const urlId = parseInt(req.params.id);
      const urls = await storage.getUserUrls(req.user!.id, 1, 0);
      const url = urls.find(u => u.id === urlId);
      
      if (!url) {
        return res.status(404).send("URL not found");
      }
      
      const updatedUrl = await storage.updateUrl(urlId, req.user!.id, { title });
      
      await storage.logActivity({
        userId: req.user!.id,
        type: "url_title_update",
        metadata: {
          urlId: updatedUrl.id,
          title
        }
      });
      
      res.json(updatedUrl);
    } catch (error) {
      console.error("Error updating URL title:", error);
      res.status(500).json({ error: "Failed to update URL title" });
    }
  });
  
  // Update shortcode for a URL
  app.patch("/api/urls/:id/shortcode", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { shortCode } = req.body;
    if (!shortCode) {
      return res.status(400).json({ error: "Short code is required" });
    }
    
    try {
      // Check if shortcode already exists
      const existingUrl = await storage.getUrlByShortCode(shortCode);
      if (existingUrl) {
        return res.status(400).json({ error: "This short code is already in use" });
      }
      
      const urlId = parseInt(req.params.id);
      const urls = await storage.getUserUrls(req.user!.id, 1, 0);
      const url = urls.find(u => u.id === urlId);
      
      if (!url) {
        return res.status(404).send("URL not found");
      }
      
      const oldShortCode = url.shortCode;
      const updatedUrl = await storage.updateUrl(urlId, req.user!.id, { shortCode });
      
      await storage.logActivity({
        userId: req.user!.id,
        type: "url_shortcode_update",
        metadata: {
          urlId: updatedUrl.id,
          oldShortCode,
          newShortCode: shortCode
        }
      });
      
      res.json(updatedUrl);
    } catch (error) {
      console.error("Error updating URL shortcode:", error);
      res.status(500).json({ error: "Failed to update URL shortcode" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

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