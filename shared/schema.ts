import { pgTable, text, serial, integer, timestamp, jsonb, boolean, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique(), // No longer required
  password: text("password"), // Can be null for Microsoft authentication
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(), // Email is now unique and the primary identifier
  company: text("company"),
  role: text("role").notNull().default("user"),
  userType: text("user_type").notNull().default("external"), // 'internal' or 'external'
  isApproved: boolean("is_approved").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  microsoftId: text("microsoft_id").unique(),
  inviteToken: text("invite_token").unique(),
  inviteSentAt: timestamp("invite_sent_at"),
  inviteAcceptedAt: timestamp("invite_accepted_at"),
});

export const urls = pgTable("urls", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  originalUrl: text("original_url").notNull(),
  shortCode: text("short_code").notNull().unique(),
  title: text("title"),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  // Multi-destination URLs
  isMultiDestination: boolean("is_multi_destination").notNull().default(false),
  destinations: jsonb("destinations").notNull().default({
    ios: "",
    android: "",
    desktop: ""
  }),
  // PDF document support
  isPdfDocument: boolean("is_pdf_document").notNull().default(false),
  pdfDocumentUrl: text("pdf_document_url"),
  pdfDocumentName: text("pdf_document_name"),
  pdfDocumentSize: integer("pdf_document_size"),
  analytics: jsonb("analytics").notNull().default({
    devices: {
      desktop: 0,
      mobile: 0,
      tablet: 0,
    },
    countries: {},
    referrers: {}
  }),
  qrConfig: jsonb("qr_config").notNull().default({
    fgColor: "#000000",
    bgColor: "#FFFFFF",
    includeMargin: true,
    logoUrl: "",
    pattern: "squares",
    cornerStyle: "square",
    frameStyle: "none",
    cornerDotColor: "#000000",
    cornerSquareColor: "#000000",
    frameColor: "#000000",
  }),
  password: text("password"),
  isPasswordProtected: boolean("is_password_protected").notNull().default(false),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({}),
});

export const insertUserSchema = createInsertSchema(users).extend({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  company: z.string().optional(),
});

export const destinationsSchema = z.object({
  ios: z.string().url("Must be a valid URL").or(z.literal("")),
  android: z.string().url("Must be a valid URL").or(z.literal("")),
  desktop: z.string().url("Must be a valid URL").or(z.literal(""))
});

export const insertUrlSchema = createInsertSchema(urls).pick({
  originalUrl: true,
}).extend({
  originalUrl: z.string()
    .min(1, "URL is required")
    .url("Please enter a valid URL (e.g., https://example.com)")
    .refine(
      (url) => {
        try {
          // Additional validation to ensure it's a complete URL with protocol
          const parsedUrl = new URL(url);
          return !!parsedUrl.protocol && !!parsedUrl.host;
        } catch (e) {
          return false;
        }
      },
      {
        message: "Please enter a complete URL including https:// or http://"
      }
    ),
  password: z.string().optional(),
  expiresAt: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  isMultiDestination: z.boolean().optional().default(false),
  destinations: destinationsSchema.optional(),
  isPdfDocument: z.boolean().optional().default(false),
  pdfDocumentUrl: z.string().optional(),
  pdfDocumentName: z.string().optional(),
  pdfDocumentSize: z.number().optional(),
});

export const qrConfigSchema = z.object({
  fgColor: z.string(),
  bgColor: z.string(),
  includeMargin: z.boolean(),
  logoUrl: z.string(),
  pattern: z.enum(["squares", "dots", "rounded", "classy", "elegant"]),
  cornerStyle: z.enum(["square", "dot", "extra-rounded"]),
  frameStyle: z.enum(["none", "simple", "dots"]),
  cornerDotColor: z.string(),
  cornerSquareColor: z.string(),
  frameColor: z.string(),
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Url = typeof urls.$inferSelect;
export type InsertUrl = z.infer<typeof insertUrlSchema>;
export type QrConfig = z.infer<typeof qrConfigSchema>;
export type Destinations = z.infer<typeof destinationsSchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type UserRole = "admin" | "user";
export type UserType = "internal" | "external";

export const userApprovalSchema = z.object({
  userId: z.number(),
  isApproved: z.boolean(),
  isActive: z.boolean(),
  role: z.enum(["admin", "user"]).optional(),
  userType: z.enum(["internal", "external"]).optional(),
});

export const userInviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  company: z.string().optional(),
  userType: z.enum(["internal", "external"]).default("external"),
  role: z.enum(["admin", "user"]).default("user"),
});

export const inviteAcceptSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
  username: z.string().optional(), // Username is now optional
  password: z.string().min(6, "Password must be at least 6 characters").optional(), // Password is optional for internal users
});

// Digital asset management schema
export const assetFolders = pgTable("asset_folders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  parentId: integer("parent_id"),
  path: text("path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assetFiles = pgTable("asset_files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  folderId: integer("folder_id"),
  name: varchar("name", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  fileUrl: text("file_url").notNull(),
  storageFileName: text("storage_file_name").notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  contentType: varchar("content_type", { length: 100 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Folder schema
export const insertFolderSchema = createInsertSchema(assetFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Folder name is required").max(255, "Folder name is too long"),
  parentId: z.number().optional().nullable(),
});

// File schema with security validation
export const insertFileSchema = createInsertSchema(assetFiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "File name is required").max(255, "File name is too long"),
  folderId: z.number().optional().nullable(),
  fileType: z.string().refine(
    (type) => {
      // Allowed file types - block executable and script files
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'application/json',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'video/mp4', 'video/mpeg', 'video/webm'
      ];
      return allowedTypes.includes(type);
    },
    {
      message: "This file type is not allowed for security reasons"
    }
  ),
  fileSize: z.number().max(50 * 1024 * 1024, "File exceeds the 50MB size limit"),
});

export type AssetFolder = typeof assetFolders.$inferSelect;
export type InsertAssetFolder = z.infer<typeof insertFolderSchema>;
export type AssetFile = typeof assetFiles.$inferSelect;
export type InsertAssetFile = z.infer<typeof insertFileSchema>;
export type UserApproval = z.infer<typeof userApprovalSchema>;
export type UserInvite = z.infer<typeof userInviteSchema>;
export type InviteAccept = z.infer<typeof inviteAcceptSchema>;