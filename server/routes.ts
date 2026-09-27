import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { 
  insertUrlSchema, destinationsSchema, userApprovalSchema, userInviteSchema, inviteAcceptSchema, 
  insertFolderSchema, insertFileSchema, urls 
} from "@shared/schema";
import { qrConfigSchema } from "@shared/schema";
import { UAParser } from "ua-parser-js";
import { scrypt, timingSafeEqual, randomBytes } from "crypto";
import { promisify } from "util";
import {
  AISuggestionError,
  aiSuggestionService,
} from "./services/ai-suggestion-service";
import { emailService } from "./services/email-service";
import { fileStorage } from "./services/file-storage";
import { servePdfDocument } from "./pdf-handler";
import multer from "multer";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { getName } from 'country-list';
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import { geolocationService } from "./services/geolocation-service";

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

  // Configure multer for PDF uploads
  const pdfStorage = multer.memoryStorage();
  const pdfUpload = multer({
    storage: pdfStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
    fileFilter: (req, file, cb) => {
      // Only allow PDF files
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(null, false);
        return cb(new Error('Only PDF format is allowed'));
      }
    }
  });

  // PDF document upload endpoint
  app.post("/api/pdf-upload", pdfUpload.single('pdfFile'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file provided" });
      }
      
      // Upload file to storage
      const fileBuffer = req.file.buffer;
      const originalName = req.file.originalname;
      const fileSize = req.file.size;
      const contentType = req.file.mimetype;
      
      const fileUrl = await fileStorage.uploadFile(
        fileBuffer,
        originalName,
        contentType
      );
      
      // Return success with file info
      res.status(200).json({
        success: true,
        fileUrl,
        fileName: originalName,
        fileSize,
        message: "PDF successfully uploaded"
      });
      
    } catch (error) {
      console.error("Error uploading PDF:", error);
      res.status(500).json({ 
        error: "PDF upload failed", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

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

    // Check for empty URL
    if (!req.body.originalUrl || req.body.originalUrl.trim() === '') {
      return res.status(400).json({ 
        error: {
          message: "URL is required",
          path: ["originalUrl"]
        }
      });
    }

    // Validate URL format using our schema
    const parseResult = insertUrlSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }
    
    // Additional URL validation for extra security
    try {
      new URL(parseResult.data.originalUrl);
    } catch (error) {
      return res.status(400).json({
        error: {
          message: "Invalid URL format. Please include http:// or https://",
          path: ["originalUrl"]
        }
      });
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
      const title = await aiSuggestionService.generateTitle({ url: url.originalUrl });
      if (title) {
        await storage.updateUrl(url.id, req.user!.id, { title });
      }
    } catch {
      console.warn("Automatic title generation was skipped.");
      // Don't block the response or fail if title generation fails
    }

    res.status(201).json(url);
  });

  app.delete("/api/urls/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const urlId = parseInt(req.params.id);
      
      // Direct database query to get the specific URL by ID and user ID
      const [url] = await db
        .select()
        .from(urls)
        .where(and(
          eq(urls.id, urlId),
          eq(urls.userId, req.user!.id)
        ));

      if (!url) {
        console.log(`URL not found or not owned by user: ID ${urlId}, user ${req.user!.id}`);
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

  // Special route for password-verified PDF documents
  app.get("/verified-pdf/:shortCode", async (req, res) => {
    const url = await storage.getUrlByShortCode(req.params.shortCode);
    if (!url) return res.sendStatus(404);
    
    // Check if URL has expired
    if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
      return res.status(410).send("This link has expired.");
    }
    
    // Simple token validation
    const token = req.query.token as string;
    if (!token || !token.startsWith('pdf_verified_')) {
      return res.redirect(`/${req.params.shortCode}`);
    }
    
    // Make sure this is actually a PDF document
    if (!url.isPdfDocument) {
      return res.redirect(`/${req.params.shortCode}`);
    }
    
    console.log(`Serving verified PDF document for shortcode ${url.shortCode}`);
    
    // Directly serve the PDF document through our custom viewer
    return servePdfDocument(res, url);
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
    
    // Skip requests that look like they're for PDF document placeholder URLs
    if (req.params.shortCode.startsWith('pdf-document-url-')) {
      console.log(`Skipping direct access to PDF placeholder URL: ${req.params.shortCode}`);
      return next();
    }
    
    console.log(`Processing shortcode request: ${req.params.shortCode}`);
    const url = await storage.getUrlByShortCode(req.params.shortCode);
    if (!url) {
      console.log(`No URL found for shortcode: ${req.params.shortCode}`);
      return next();
    }
    
    // Check if URL has expired
    if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
      return res.status(410).send("This link has expired.");
    }

    if (url.isPasswordProtected) {
      return res.redirect(`/protected/${url.shortCode}`);
    }

    const deviceType = getDeviceType(req.headers['user-agent'] || '');
    const devicePlatform = getDevicePlatform(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    const countryInfo = await getCountryCode(req);
    const deviceInfo = getDetailedDeviceInfo(req.headers['user-agent'] || '');

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryInfo, referrer, deviceInfo);
      
      // Check if this is a PDF document URL
      if (url.isPdfDocument) {
        console.log(`Serving PDF document for shortcode ${url.shortCode}:`, {
          title: url.title,
          isPdfDocument: url.isPdfDocument,
          pdfDocumentUrl: url.pdfDocumentUrl,
          pdfDocumentName: url.pdfDocumentName,
          pdfDocumentSize: url.pdfDocumentSize,
          shortCode: url.shortCode
        });
        
        // We've already imported servePdfDocument at the top of the file
        return servePdfDocument(res, url);
      }
      
      // Handle multi-destination URLs - redirect based on device platform
      if (url.isMultiDestination && url.destinations) {
        // Parse destinations JSON if it's a string
        const destinations = typeof url.destinations === 'string' 
          ? JSON.parse(url.destinations) 
          : url.destinations;
        
        let redirectUrl = url.originalUrl; // Default fallback
        
        if (devicePlatform === 'ios' && destinations.ios) {
          redirectUrl = destinations.ios;
          console.log(`Multi-destination URL: Redirecting iOS device to ${redirectUrl}`);
        } 
        else if (devicePlatform === 'android' && destinations.android) {
          redirectUrl = destinations.android;
          console.log(`Multi-destination URL: Redirecting Android device to ${redirectUrl}`);
        }
        else if (devicePlatform === 'desktop' && destinations.desktop) {
          redirectUrl = destinations.desktop;
          console.log(`Multi-destination URL: Redirecting desktop device to ${redirectUrl}`);
        }
        
        return res.redirect(redirectUrl);
      }
      
      // Regular URL - just redirect to the original URL
      res.redirect(url.originalUrl);
    } catch (error) {
      console.error('Error incrementing clicks:', error);
      
      // Even in case of error, try to serve PDF documents properly
      if (url.isPdfDocument) {
        // We've already imported servePdfDocument at the top of the file
        return servePdfDocument(res, url);
      }
      
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
    const devicePlatform = getDevicePlatform(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    const countryInfo = await getCountryCode(req);
    const deviceInfo = getDetailedDeviceInfo(req.headers['user-agent'] || '');

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryInfo, referrer, deviceInfo);
      
      // Check if this is a PDF document URL
      if (url.isPdfDocument) {
        console.log(`Serving PDF document from /api/r/ route for shortcode ${url.shortCode}`);
        
        // We've already imported servePdfDocument at the top of the file
        return servePdfDocument(res, url);
      }
      
      // Handle multi-destination URLs - redirect based on device platform
      if (url.isMultiDestination && url.destinations) {
        // Parse destinations JSON if it's a string
        const destinations = typeof url.destinations === 'string' 
          ? JSON.parse(url.destinations) 
          : url.destinations;
        
        let redirectUrl = url.originalUrl; // Default fallback
        
        if (devicePlatform === 'ios' && destinations.ios) {
          redirectUrl = destinations.ios;
          console.log(`Multi-destination URL: Redirecting iOS device to ${redirectUrl}`);
        } 
        else if (devicePlatform === 'android' && destinations.android) {
          redirectUrl = destinations.android;
          console.log(`Multi-destination URL: Redirecting Android device to ${redirectUrl}`);
        }
        else if (devicePlatform === 'desktop' && destinations.desktop) {
          redirectUrl = destinations.desktop;
          console.log(`Multi-destination URL: Redirecting desktop device to ${redirectUrl}`);
        }
        
        return res.redirect(redirectUrl);
      }
      
      // Regular URL - just redirect to the original URL
      res.redirect(url.originalUrl);
    } catch (error) {
      console.error('Error incrementing clicks:', error);
      
      // Even in case of error, try to serve PDF documents properly
      if (url.isPdfDocument) {
        // We've already imported servePdfDocument at the top of the file
        return servePdfDocument(res, url);
      }
      
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
    const devicePlatform = getDevicePlatform(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    const countryInfo = await getCountryCode(req);
    const deviceInfo = getDetailedDeviceInfo(req.headers['user-agent'] || '');

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryInfo, referrer, deviceInfo);
      
      // Check if this is a PDF document URL
      if (url.isPdfDocument) {
        console.log(`Password-protected PDF document URL verified: Serving PDF directly via viewer`);
        console.log(`PDF Document details:`, { 
          isPdfDocument: url.isPdfDocument,
          pdfDocumentUrl: url.pdfDocumentUrl,
          shortCode: url.shortCode
        });
        
        // Instead of redirecting through the same mechanism, we'll generate a one-time token
        // that can be used to directly serve the PDF
        const timestamp = Date.now();
        const oneTimeAccessToken = `pdf_verified_${timestamp}_${url.id}`;
        
        // Create a special route for password-verified PDFs
        return res.json({ 
          redirectUrl: `/verified-pdf/${url.shortCode}?token=${oneTimeAccessToken}`,
          isPdfDocument: true
        });
      }
      
      // Handle multi-destination URLs for password-protected links
      if (url.isMultiDestination && url.destinations) {
        // Parse destinations JSON if it's a string
        const destinations = typeof url.destinations === 'string' 
          ? JSON.parse(url.destinations) 
          : url.destinations;
        
        let redirectUrl = url.originalUrl; // Default fallback
        
        if (devicePlatform === 'ios' && destinations.ios) {
          redirectUrl = destinations.ios;
          console.log(`Protected multi-destination URL: Redirecting iOS device to ${redirectUrl}`);
        } 
        else if (devicePlatform === 'android' && destinations.android) {
          redirectUrl = destinations.android;
          console.log(`Protected multi-destination URL: Redirecting Android device to ${redirectUrl}`);
        }
        else if (devicePlatform === 'desktop' && destinations.desktop) {
          redirectUrl = destinations.desktop;
          console.log(`Protected multi-destination URL: Redirecting desktop device to ${redirectUrl}`);
        }
        
        return res.json({ redirectUrl });
      }
      
      // Regular URL
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
    const devicePlatform = getDevicePlatform(req.headers['user-agent'] || '');
    const referrer = getReferrer(req.headers.referer);
    const countryInfo = await getCountryCode(req);
    const deviceInfo = getDetailedDeviceInfo(req.headers['user-agent'] || '');

    try {
      await storage.incrementUrlClicks(url.id, url.userId, deviceType, countryInfo, referrer, deviceInfo);
      
      // Check if this is a PDF document URL
      if (url.isPdfDocument) {
        console.log(`Password-protected PDF document URL verified (legacy route): Serving PDF directly via viewer`);
        
        // Use the same one-time token approach for the legacy route
        const timestamp = Date.now();
        const oneTimeAccessToken = `pdf_verified_${timestamp}_${url.id}`;
        
        // Create a special route for password-verified PDFs
        return res.json({ 
          redirectUrl: `/verified-pdf/${url.shortCode}?token=${oneTimeAccessToken}`,
          isPdfDocument: true
        });
      }
      
      // Handle multi-destination URLs for password-protected links
      if (url.isMultiDestination && url.destinations) {
        // Parse destinations JSON if it's a string
        const destinations = typeof url.destinations === 'string' 
          ? JSON.parse(url.destinations) 
          : url.destinations;
        
        let redirectUrl = url.originalUrl; // Default fallback
        
        if (devicePlatform === 'ios' && destinations.ios) {
          redirectUrl = destinations.ios;
          console.log(`Protected multi-destination URL: Redirecting iOS device to ${redirectUrl}`);
        } 
        else if (devicePlatform === 'android' && destinations.android) {
          redirectUrl = destinations.android;
          console.log(`Protected multi-destination URL: Redirecting Android device to ${redirectUrl}`);
        }
        else if (devicePlatform === 'desktop' && destinations.desktop) {
          redirectUrl = destinations.desktop;
          console.log(`Protected multi-destination URL: Redirecting desktop device to ${redirectUrl}`);
        }
        
        return res.json({ redirectUrl });
      }
      
      // Regular URL
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
  
  // QR code logos are kept in file storage (local disk doesn't persist on serverless hosts)
  const logoTypes: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  const logoContentTypes = Object.fromEntries(
    Object.entries(logoTypes).map(([type, ext]) => [ext, type]),
  );

  const logoUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 2 * 1024 * 1024 // 2MB max size
    },
    fileFilter: function(req, file, cb) {
      cb(null, file.mimetype in logoTypes);
    }
  });

  // Logo upload endpoint
  app.post('/api/upload-logo', (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    logoUpload.single('logo')(req, res, async (err: unknown) => {
      if (err) {
        const tooLarge = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE';
        return res.status(400).json({ error: tooLarge ? "Logo must be 2MB or smaller" : "Invalid logo upload" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "Please upload a PNG, JPG, GIF or SVG image" });
      }

      try {
        const name = await fileStorage.uploadLogo(
          req.file.buffer,
          logoTypes[req.file.mimetype],
          req.file.mimetype,
        );
        res.json({ success: true, logoUrl: `/api/logos/${name}` });
      } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({ error: "Failed to store logo" });
      }
    });
  });

  // Public so QR codes can embed the logo; names are unguessable and immutable.
  app.get('/api/logos/:name', async (req, res) => {
    const match = /^logo-[a-z0-9-]+\.(png|jpg|gif|svg)$/.exec(req.params.name);
    if (!match) return res.sendStatus(404);

    try {
      const data = await fileStorage.downloadLogo(req.params.name);
      if (!data) return res.sendStatus(404);
      res.set({
        'Content-Type': logoContentTypes[match[1]],
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        // SVGs can carry scripts; never let them run if opened directly
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      });
      res.send(data);
    } catch (error) {
      console.error('Error serving logo:', error);
      res.sendStatus(500);
    }
  });

  app.patch("/api/urls/:id/shortcode", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { shortCode } = req.body;
    if (!shortCode) {
      return res.status(400).json({ error: "Short code is required" });
    }

    try {
      // Verify the URL belongs to the current user
      const urlId = parseInt(req.params.id);
      const urls = await storage.getUserUrls(req.user!.id, 1, 0);
      const url = urls.find(u => u.id === urlId);
      if (!url) {
        return res.status(404).send("URL not found");
      }

      // Check if shortcode is already in use
      const existingUrl = await storage.getUrlByShortCode(shortCode);
      if (existingUrl && existingUrl.id !== urlId) {
        return res.status(409).json({ error: "Short code is already in use" });
      }

      // Update URL with new shortcode
      const updatedUrl = await storage.updateUrl(urlId, req.user!.id, {
        shortCode
      });

      // Log shortcode update
      await storage.logActivity({
        userId: req.user!.id,
        type: "url_shortcode_updated",
        metadata: {
          urlId: updatedUrl.id,
          oldShortCode: url.shortCode,
          newShortCode: shortCode
        }
      });

      res.json(updatedUrl);
    } catch (error) {
      console.error('Error updating shortcode:', error);
      res.status(500).json({ error: "Failed to update shortcode" });
    }
  });

  app.patch("/api/urls/:id/title", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    try {
      // Verify the URL belongs to the current user
      const urlId = parseInt(req.params.id);
      const urls = await storage.getUserUrls(req.user!.id, 1, 0);
      const url = urls.find(u => u.id === urlId);
      if (!url) {
        return res.status(404).send("URL not found");
      }

      // Update URL with new title
      const updatedUrl = await storage.updateUrl(urlId, req.user!.id, {
        title
      });

      // Log title update
      await storage.logActivity({
        userId: req.user!.id,
        type: "url_title_updated",
        metadata: {
          urlId: updatedUrl.id,
          oldTitle: url.title || "",
          newTitle: title
        }
      });

      res.json(updatedUrl);
    } catch (error) {
      console.error('Error updating title:', error);
      res.status(500).json({ error: "Failed to update title" });
    }
  });

  app.post("/api/ai/generate-title", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
  
    const { url } = req.body ?? {};
    if (typeof url !== "string" || !url.trim()) {
      return res.status(400).json({ error: "A URL is required to generate a title." });
    }
    
    try {
      const title = await aiSuggestionService.generateTitle({ url });
      res.json({ title });
    } catch (error) {
      if (error instanceof AISuggestionError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error("Unexpected error in AI title suggestion endpoint.");
      res.status(503).json({
        error: "The AI provider could not generate a title right now. Please try again later.",
      });
    }
  });
  
  app.post("/api/ai/generate-shortcodes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
  
    const { url, title, count = 5 } = req.body ?? {};
    if (typeof url !== "string" || !url.trim()) {
      return res.status(400).json({
        error: "A URL is required to generate shortcode suggestions.",
      });
    }
    if (
      (title !== undefined && typeof title !== "string") ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 8
    ) {
      return res.status(400).json({
        error: "Shortcode suggestion count must be between 1 and 8.",
      });
    }
    
    try {
      const shortcodes =
        await aiSuggestionService.generateShortcodeSuggestions({
        url,
        title,
        count,
      });
      res.json({ shortcodes });
    } catch (error) {
      if (error instanceof AISuggestionError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error("Unexpected error in AI shortcode suggestion endpoint.");
      res.status(503).json({
        error: "The AI provider could not generate shortcode suggestions right now. Please try again later.",
      });
    }
  });

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

      // Parse expiry date if provided
      let parsedExpiryDate = null;
      if (expiresAt) {
        parsedExpiryDate = new Date(expiresAt);
        if (isNaN(parsedExpiryDate.getTime())) {
          return res.status(400).json({ error: "Invalid expiry date format" });
        }
      }

      // Update URL with new expiry settings
      const updatedUrl = await storage.updateUrl(urlId, req.user!.id, {
        expiresAt: parsedExpiryDate
      });

      // Log expiry update
      await storage.logActivity({
        userId: req.user!.id,
        type: "url_expiry_updated",
        metadata: {
          urlId: updatedUrl.id,
          oldExpiryDate: url.expiresAt ? new Date(url.expiresAt).toISOString() : null,
          newExpiryDate: updatedUrl.expiresAt ? new Date(updatedUrl.expiresAt).toISOString() : null
        }
      });

      res.json(updatedUrl);
    } catch (error) {
      console.error('Error updating URL expiry:', error);
      res.status(500).json({ error: "Failed to update URL expiry" });
    }
  });

  app.patch("/api/urls/:id/destinations", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const { isMultiDestination, destinations } = req.body;

    if (isMultiDestination === undefined) {
      return res.status(400).json({ error: "isMultiDestination flag is required" });
    }

    if (isMultiDestination && !destinations) {
      return res.status(400).json({ error: "Destinations are required when isMultiDestination is true" });
    }

    try {
      // Validate destinations if provided
      if (destinations) {
        const parseResult = destinationsSchema.safeParse(destinations);
        if (!parseResult.success) {
          return res.status(400).json({ error: "Invalid destinations format", details: parseResult.error });
        }
      }

      // Verify the URL belongs to the current user
      const urlId = parseInt(req.params.id);
      const urls = await storage.getUserUrls(req.user!.id);
      const url = urls.find(u => u.id === urlId);
      
      if (!url) {
        return res.status(404).send("URL not found");
      }

      // Update URL with multi-destination settings
      const updatedUrl = await storage.updateUrl(urlId, req.user!.id, {
        isMultiDestination,
        destinations: isMultiDestination ? destinations : null
      });

      // Log multi-destination update
      await storage.logActivity({
        userId: req.user!.id,
        type: "url_destinations_updated",
        metadata: {
          urlId: updatedUrl.id,
          isMultiDestination
        }
      });

      res.json(updatedUrl);
    } catch (error) {
      console.error('Error updating URL destinations:', error);
      res.status(500).json({ error: "Failed to update URL destinations" });
    }
  });
  
  // Get current user activities
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
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });
  
  // Admin routes for user management
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id/approve", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }

    const parseResult = userApprovalSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    try {
      const userId = parseInt(req.params.id);
      
      const updatedUser = await storage.updateUserApproval({
        userId,
        isApproved: parseResult.data.isApproved
      });

      // Log user approval update
      await storage.logActivity({
        userId: req.user!.id,
        type: "user_approval_updated",
        metadata: {
          targetUserId: userId,
          isApproved: parseResult.data.isApproved
        }
      });

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user approval:', error);
      res.status(500).json({ error: "Failed to update user approval" });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }

    try {
      const userId = parseInt(req.params.id);
      
      // Check if trying to delete oneself
      if (userId === req.user!.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      // Get the user details before deletion for logging
      const users = await storage.getAllUsers();
      const userToDelete = users.find(u => u.id === userId);
      
      if (!userToDelete) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await storage.deleteUser(userId);

      // Log user deletion
      await storage.logActivity({
        userId: req.user!.id,
        type: "user_deleted",
        metadata: {
          deletedUserId: userId,
          deletedUserRole: userToDelete.role,
          deletedUserEmail: userToDelete.email
        }
      });

      res.sendStatus(200);
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });
  
  // Invite system
  app.post("/api/invites", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }

    const parseResult = userInviteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    try {
      const { email, firstName, lastName, company, userType, role } = parseResult.data;
      
      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "A user with this email already exists" });
      }
      
      // Create invitation and get token
      const { user, token } = await storage.createInvitation({ 
        email, 
        firstName, 
        lastName, 
        company, 
        userType: userType || 'external',
        role: role || 'user'
      });
      
      // Send invitation email
      await emailService.sendInvitation(email, firstName, lastName, token);
      
      // Log invitation creation
      await storage.logActivity({
        userId: req.user!.id,
        type: "invitation_created",
        metadata: {
          invitedUserEmail: email,
          invitedUserId: user.id
        }
      });
      
      res.status(201).json({ 
        success: true, 
        message: "Invitation created and sent", 
        user 
      });
      
    } catch (error) {
      console.error('Error creating invitation:', error);
      res.status(500).json({ 
        error: "Failed to create invitation",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/invites/:token", async (req, res) => {
    try {
      const user = await storage.getUserByInviteToken(req.params.token);
      if (!user) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }
      
      // Return basic user info (deliberately limiting data returned for security)
      res.json({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      });
      
    } catch (error) {
      console.error('Error validating invitation:', error);
      res.status(500).json({ error: "Failed to validate invitation" });
    }
  });

  app.post("/api/invites/:token/accept", async (req, res) => {
    const parseResult = inviteAcceptSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(parseResult.error);
    }

    try {
      const { username, password } = parseResult.data;
      
      // Check if username is already taken
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: "Username is already taken" });
      }
      
      // Accept invitation
      const user = await storage.acceptInvitation(req.params.token, {
        username,
        password
      });
      
      // Log successful invitation acceptance
      await storage.logActivity({
        userId: user.id,
        type: "invitation_accepted",
        metadata: {}
      });
      
      res.json({ success: true, message: "Invitation accepted" });
      
    } catch (error) {
      console.error('Error accepting invitation:', error);
      res.status(500).json({ 
        error: "Failed to accept invitation",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
      error: 'Server error', 
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
  });

  // Configure file upload for digital assets
  const assetStorage = multer.memoryStorage();
  const assetUpload = multer({
    storage: assetStorage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    fileFilter: (req, file, cb) => {
      // Whitelist of allowed file types
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'application/json',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'video/mp4', 'video/mpeg', 'video/webm'
      ];

      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(null, false);
        return cb(new Error('This file type is not allowed for security reasons'));
      }
    }
  });

  // Digital Asset Management API Routes
  
  // Get all folders for the authenticated user
  app.get("/api/assets/folders", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const folders = await storage.getUserFolders(req.user!.id);
      res.json(folders);
    } catch (error) {
      console.error('Error fetching folders:', error);
      res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  // Create a new folder
  app.post("/api/assets/folders", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const parseResult = insertFolderSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json(parseResult.error);
      }
      
      const folder = await storage.createFolder({
        ...parseResult.data,
        userId: req.user!.id
      });
      
      res.status(201).json(folder);
    } catch (error) {
      console.error('Error creating folder:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create folder";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Update a folder
  app.patch("/api/assets/folders/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const folderId = parseInt(req.params.id);
      
      // Ensure folder exists and belongs to user
      const folder = await storage.getFolderById(folderId, req.user!.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      
      const updatedFolder = await storage.updateFolder(folderId, req.user!.id, req.body);
      res.json(updatedFolder);
    } catch (error) {
      console.error('Error updating folder:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update folder";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Delete a folder
  app.delete("/api/assets/folders/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const folderId = parseInt(req.params.id);
      
      // Ensure folder exists and belongs to user
      const folder = await storage.getFolderById(folderId, req.user!.id);
      if (!folder) {
        return res.status(404).json({ error: "Folder not found" });
      }
      
      await storage.deleteFolder(folderId, req.user!.id);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error deleting folder:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete folder";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get files in a folder or all files
  app.get("/api/assets/files", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Parse folderId from query string
      let folderId: number | null = null;
      if (req.query.folderId) {
        if (req.query.folderId === 'null') {
          folderId = null; // Explicitly set null
        } else {
          const parsedId = parseInt(req.query.folderId as string);
          if (!isNaN(parsedId)) {
            folderId = parsedId;
          } else {
            console.error('Invalid folderId in query:', req.query.folderId);
          }
        }
      }
      
      console.log(`Getting files for user ${req.user!.id} in folder:`, folderId);
      
      const files = await storage.getUserFiles(req.user!.id, folderId);
      
      // Generate secure access URLs for each file
      const filesWithUrls = await Promise.all(files.map(async file => ({
        ...file,
        secureUrl: await fileStorage.getAssetFileUrl(file.storageFileName)
      })));
      
      res.json(filesWithUrls);
    } catch (error) {
      console.error('Error getting user files:', error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  // Upload a file
  app.post("/api/assets/files", assetUpload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }
      
      const { fileUrl, fileName } = await fileStorage.uploadAssetFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.user!.id
      );
      
      // Create file database record
      const fileData = {
        userId: req.user!.id,
        name: req.body.name || req.file.originalname,
        originalName: req.file.originalname,
        fileUrl: fileUrl,
        storageFileName: fileName,
        fileType: req.file.mimetype,
        contentType: req.file.mimetype,
        fileSize: req.file.size,
        folderId: req.body.folderId ? parseInt(req.body.folderId) : null,
        description: req.body.description || null
      };
      
      const file = await storage.createFile(fileData);
      
      // Generate secure URL for the response
      const response = {
        ...file,
        secureUrl: await fileStorage.getAssetFileUrl(fileName)
      };
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Update a file
  app.patch("/api/assets/files/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const fileId = parseInt(req.params.id);
      
      // Ensure file exists and belongs to user
      const file = await storage.getFileById(fileId, req.user!.id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const updatedFile = await storage.updateFile(fileId, req.user!.id, req.body);
      if (!updatedFile) {
        return res.status(500).json({ error: "Failed to update file" });
      }
      
      // Generate secure URL for the response
      const response = {
        ...updatedFile,
        secureUrl: await fileStorage.getAssetFileUrl(updatedFile.storageFileName)
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error updating file:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update file";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Delete a file
  app.delete("/api/assets/files/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const fileId = parseInt(req.params.id);
      
      // This will handle both database deletion and Azure Storage deletion
      await storage.deleteFile(fileId, req.user!.id);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error deleting file:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete file";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Create HTTP server
  const server = createServer(app);
  return server;
}

// Get device type from user agent
function getDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  if (!userAgent) return 'desktop';
  
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();
  
  if (device.type === 'mobile') return 'mobile';
  if (device.type === 'tablet') return 'tablet';
  return 'desktop';
}

// Get device platform (ios, android, desktop)
function getDevicePlatform(userAgent: string): 'ios' | 'android' | 'desktop' {
  if (!userAgent) return 'desktop';
  
  const parser = new UAParser(userAgent);
  const os = parser.getOS();
  
  if (os.name === 'iOS') return 'ios';
  if (os.name === 'Android') return 'android';
  return 'desktop';
}

// Get detailed device information
function getDetailedDeviceInfo(userAgent: string): {
  type: 'desktop' | 'mobile' | 'tablet';
  os?: string;
  model?: string;
  brand?: string;
  platform?: 'ios' | 'android' | 'desktop';
} {
  if (!userAgent) {
    return { type: 'desktop', platform: 'desktop' };
  }
  
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();
  const os = parser.getOS();
  
  const deviceType = device.type === 'mobile' ? 'mobile' : 
                     device.type === 'tablet' ? 'tablet' : 'desktop';
                     
  const platform = os.name === 'iOS' ? 'ios' : 
                  os.name === 'Android' ? 'android' : 'desktop';
                  
  return {
    type: deviceType as 'desktop' | 'mobile' | 'tablet',
    os: os.name ? `${os.name} ${os.version || ''}` : undefined,
    model: device.model,
    brand: device.vendor,
    platform
  };
}

// Handle referrers
function getReferrer(referer: string | undefined): string {
  if (!referer) return 'direct';
  
  try {
    const url = new URL(referer);
    return url.hostname;
  } catch (e) {
    return 'invalid';
  }
}

// Get country information from request
export interface CountryInfo {
  code: string;
  name: string;
  city?: string;
}

async function getCountryCode(req: express.Request): Promise<CountryInfo> {
  // Use our comprehensive geolocation service which handles:
  // 1. Headers from trusted proxies (Cloudflare, etc)
  // 2. Smart IP-based detection with pattern matching
  // 3. GeoIP lookup with city and region data
  // 4. Fallback to test data for development
  
  try {
    // The service automatically logs detailed debugging information
    const locationInfo = await geolocationService.getLocation(req);
    
    console.log(`Location detected: ${locationInfo.name}${locationInfo.city ? `, ${locationInfo.city}` : ''}`);
    
    // Convert the GeoLocationInfo to CountryInfo format
    return {
      code: locationInfo.code,
      name: locationInfo.name,
      city: locationInfo.city
    };
  } catch (error) {
    console.error('Error determining location:', error);
    console.log('Falling back to default country: UNKNOWN');
    return { code: 'UNKNOWN', name: 'Unknown' };
  }
}