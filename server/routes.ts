import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertUrlSchema } from "@shared/schema";
import { qrConfigSchema } from "@shared/schema";
import { UAParser } from "ua-parser-js";
import { scrypt, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";
import { openAiService } from "./services/openai-service";
import { emailService } from "./services/email-service";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import geoip from 'geoip-lite';
import { getName } from 'country-list';
import { db } from "./db";
import { urls } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Load environment variables from .env file
dotenv.config();

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

  // Add admin-only data migration endpoint
  app.post('/api/admin/migrate-analytics', async (req, res) => {
    try {
      const user = req.user as any;
      if (!req.isAuthenticated() || !user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // Get all URLs
      const allUrls = await db.select().from(urls);
      let migrationCount = 0;
      let conversionCount = 0;
      
      // Process each URL
      for (const url of allUrls) {
        if (url.analytics) {
          try {
            // Create a new analytics structure with proper typing
            const oldAnalytics = url.analytics as any;
            const newAnalytics: {
              devices: Record<string, number>;
              countries: Record<string, { count: number; name: string; cities: Record<string, number> }>;
              referrers: Record<string, number>;
            } = {
              devices: oldAnalytics.devices || { desktop: 0, mobile: 0, tablet: 0 },
              countries: {},
              referrers: oldAnalytics.referrers || {}
            };
            
            // Determine if we need to perform a conversion
            let needsConversion = false;
            
            // Check if countries exist and if any entry is in the old format
            if (oldAnalytics.countries) {
              Object.entries(oldAnalytics.countries).forEach(([code, data]) => {
                if (typeof data === 'number') {
                  needsConversion = true;
                }
              });
            }
            
            // Migrate country data
            if (oldAnalytics.countries) {
              Object.entries(oldAnalytics.countries).forEach(([code, data]) => {
                if (typeof data === 'number') {
                  // Convert old format to new format
                  newAnalytics.countries[code] = {
                    count: data,
                    name: code === 'UNKNOWN' ? 'Unknown' : getName(code) || code,
                    cities: {}
                  };
                  conversionCount++;
                } else if (data && typeof data === 'object') {
                  // Already in new format, just ensure it has all properties
                  newAnalytics.countries[code] = {
                    count: (data as any).count || 0,
                    name: (data as any).name || getName(code) || code,
                    cities: (data as any).cities || {}
                  };
                }
              });
            }
            
            if (needsConversion) {
              // Update the URL with the new analytics structure
              await db
                .update(urls)
                .set({ analytics: newAnalytics })
                .where(eq(urls.id, url.id));
                
              migrationCount++;
            }
          } catch (error) {
            console.error(`Error migrating URL ${url.id}:`, error);
          }
        }
      }
      
      res.json({ 
        success: true, 
        message: `Migration completed. Updated ${migrationCount} URLs with ${conversionCount} country data conversions.` 
      });
    } catch (error) {
      console.error('Migration error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: 'Migration failed', details: errorMessage });
    }
  });

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
    
    // Check if URL has expired
    if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
      return res.status(410).send("This link has expired.");
    }

    if (url.isPasswordProtected) {
      return res.redirect(`/protected/${url.shortCode}`);
    }

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    const countryInfo = getCountryCode(req);

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryInfo, referrer);
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
    
    // Check if URL has expired
    if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
      return res.status(410).send("This link has expired.");
    }

    if (url.isPasswordProtected) {
      return res.redirect(`/protected/${url.shortCode}`);
    }

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    const countryInfo = getCountryCode(req);

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryInfo, referrer);
      res.redirect(url.originalUrl);
    } catch (error) {
      console.error('Error incrementing clicks:', error);
      res.redirect(url.originalUrl);
    }
  });

  app.post("/:shortCode/verify", async (req, res) => {
    const url = await storage.getUrlByShortCode(req.params.shortCode);
    if (!url) return res.sendStatus(404);
    
    // Check if URL has expired
    if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
      return res.status(410).json({ error: "This link has expired." });
    }

    if (!url.isPasswordProtected || !url.password) {
      return res.status(400).json({ error: "URL is not password protected" });
    }

    const isValid = await comparePasswords(req.body.password, url.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    const countryInfo = getCountryCode(req);

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryInfo, referrer);
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
    
    // Check if URL has expired
    if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
      return res.status(410).json({ error: "This link has expired." });
    }

    if (!url.isPasswordProtected || !url.password) {
      return res.status(400).json({ error: "URL is not password protected" });
    }

    const isValid = await comparePasswords(req.body.password, url.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    const countryInfo = getCountryCode(req);

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryInfo, referrer);
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

    try {
      // Get the ID from the URL parameter
      const urlId = parseInt(req.params.id);
      
      // Get user's URLs and find the specific one
      const urls = await storage.getUserUrls(req.user!.id);
      const url = urls.find(u => u.id === urlId);
      
      if (!url) {
        return res.status(404).send("URL not found");
      }

      const updatedUrl = await storage.updateUrlQrConfig(
        urlId,
        req.user!.id,
        parseResult.data
      );

      // Log activity for QR config update
      await storage.logActivity({
        userId: req.user!.id,
        type: "qr_config_update",
        metadata: {
          urlId
        }
      });

      res.json(updatedUrl);
    } catch (error) {
      console.error("Error updating QR config:", error);
      res.status(500).json({ error: "Failed to update QR config" });
    }
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
  
  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));
  
  // Configure multer for logo uploads
  const storage_config = multer.diskStorage({
    destination: function(req, file, cb) {
      const dir = path.join(process.cwd(), 'public/uploads');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      cb(null, dir);
    },
    filename: function(req, file, cb) {
      // Generate unique filename with timestamp and original extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExt = path.extname(file.originalname);
      cb(null, `logo-${uniqueSuffix}${fileExt}`);
    }
  });
  
  // Create upload middleware with file filtering for SVG and PNG
  const upload = multer({
    storage: storage_config,
    limits: {
      fileSize: 1024 * 1024 * 2, // 2MB max file size
    },
    fileFilter: function(req, file, cb) {
      // Accept only SVG and PNG
      if (file.mimetype === 'image/svg+xml' || file.mimetype === 'image/png') {
        cb(null, true);
      } else {
        cb(new Error('Only SVG and PNG files are allowed') as any, false);
      }
    }
  });
  
  // Logo upload endpoint
  app.post('/api/uploads/logo', upload.single('logo'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Return the URL to the uploaded file
      const fileUrl = `/uploads/${req.file.filename}`;
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        type: "logo_uploaded",
        metadata: {
          filename: req.file.filename,
          fileUrl
        }
      });
      
      res.json({ url: fileUrl });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ error: error.message || 'Failed to upload logo' });
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
  
  // Update expiry for a URL
  app.patch("/api/urls/:id/expiry", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const { expiresAt } = req.body;
    
    try {
      // Verify the URL belongs to the current user
      const urlId = parseInt(req.params.id);
      const urls = await storage.getUserUrls(req.user!.id, 1, 0);
      const url = urls.find(u => u.id === urlId);
      
      if (!url) {
        return res.status(404).send("URL not found");
      }
      
      const updatedUrl = await storage.updateUrl(urlId, req.user!.id, { 
        expiresAt: expiresAt ? new Date(expiresAt) : null 
      });
      
      // Log expiry update
      await storage.logActivity({
        userId: req.user!.id,
        type: "url_expiry_update",
        metadata: {
          urlId: updatedUrl.id,
          expiresAt: updatedUrl.expiresAt
        }
      });
      
      res.json(updatedUrl);
    } catch (error) {
      console.error("Error updating URL expiry:", error);
      res.status(500).json({ error: "Failed to update URL expiry" });
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
      // Check if the shortcode is already in use
      const existing = await storage.getUrlByShortCode(shortCode);
      if (existing && existing.id !== parseInt(req.params.id)) {
        return res.status(400).json({ error: "Short code is already in use" });
      }
      
      // Verify the URL belongs to the current user
      const urlId = parseInt(req.params.id);
      const urls = await storage.getUserUrls(req.user!.id, 1, 0);
      const url = urls.find(u => u.id === urlId);
      
      if (!url) {
        return res.status(404).send("URL not found");
      }
      
      const updatedUrl = await storage.updateUrl(urlId, req.user!.id, { shortCode });
      
      // Log shortcode update
      await storage.logActivity({
        userId: req.user!.id,
        type: "url_shortcode_update",
        metadata: {
          urlId: updatedUrl.id,
          shortCode
        }
      });
      
      res.json(updatedUrl);
    } catch (error) {
      console.error("Error updating URL shortcode:", error);
      res.status(500).json({ error: "Failed to update URL shortcode" });
    }
  });
  
  app.get("/api/user/activities", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    try {
      const [activities, total] = await Promise.all([
        storage.getUserActivities(req.user!.id, limit, offset),
        storage.getUserActivitiesCount(req.user!.id)
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
      console.error("Error fetching user activities:", error);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });
  
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }
    
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  app.patch("/api/users/:id/approve", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }
    
    try {
      const userId = parseInt(req.params.id);
      const { approved } = req.body;
      
      if (typeof approved !== "boolean") {
        return res.status(400).json({ error: "Approved status is required as a boolean" });
      }
      
      const user = await storage.updateUserApproval({ 
        userId, 
        isApproved: approved,
        isActive: true 
      });
      
      await storage.logActivity({
        userId: req.user!.id,
        type: "user_approval_change",
        metadata: {
          targetUserId: userId,
          approved
        }
      });
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user approval:", error);
      res.status(500).json({ error: "Failed to update user approval" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Enhanced device detection that returns OS and model information when available
interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  os?: string;
  model?: string;
  brand?: string;
}

function getDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  const deviceInfo = getDetailedDeviceInfo(userAgent);
  return deviceInfo.type;
}

function getDetailedDeviceInfo(userAgent: string): DeviceInfo {
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();
  const os = parser.getOS();
  
  const deviceInfo: DeviceInfo = {
    type: 'desktop'
  };
  
  // Set device type
  if (device.type === 'tablet') deviceInfo.type = 'tablet';
  else if (device.type === 'mobile') deviceInfo.type = 'mobile';
  
  // Add OS info
  if (os.name) {
    deviceInfo.os = os.name + (os.version ? ` ${os.version}` : '');
  }
  
  // Add device model and brand when available
  if (device.model) deviceInfo.model = device.model;
  if (device.vendor) deviceInfo.brand = device.vendor;
  
  return deviceInfo;
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

export interface CountryInfo {
  code: string;
  name: string;
  city?: string;
}

function getCountryCode(req: express.Request): CountryInfo {
  // First try Cloudflare country header (for production with Cloudflare)
  const cfCountry = (req.headers['cf-ipcountry'] as string)?.toUpperCase();
  
  // For Cloudflare headers, we don't get city info, but we can get the country
  if (cfCountry) {
    const countryName = getName(cfCountry) || cfCountry;
    
    // If we have a user-provided city from an X-City header (custom header), use it
    const cfCity = req.headers['x-city'] as string;
    return { 
      code: cfCountry, 
      name: countryName,
      city: cfCity || undefined
    };
  }

  // Next, try to get the client IP address
  const ip = 
    (req.headers['x-forwarded-for'] as string)?.split(',').shift()?.trim() || 
    req.socket.remoteAddress || 
    'unknown';
  
  if (ip && ip !== 'unknown' && ip !== '127.0.0.1' && ip !== '::1') {
    try {
      const geo = geoip.lookup(ip);
      if (geo && geo.country) {
        const countryName = getName(geo.country) || geo.country;
        
        // Format city name with proper capitalization
        let cityName = undefined;
        if (geo.city) {
          // Convert to lowercase first, then capitalize first letter
          cityName = geo.city.charAt(0).toUpperCase() + geo.city.slice(1).toLowerCase();
        }
        
        console.log(`Detected location for IP ${ip}: ${geo.country} (${countryName}), City: ${cityName || 'unknown'}`);
        
        return { 
          code: geo.country, 
          name: countryName,
          city: cityName
        };
      }
    } catch (error) {
      console.error(`Error looking up country for IP ${ip}:`, error);
    }
  }

  return { code: 'UNKNOWN', name: 'Unknown Country' };
}