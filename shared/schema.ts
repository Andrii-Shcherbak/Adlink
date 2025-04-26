import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
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

export const insertUrlSchema = createInsertSchema(urls).pick({
  originalUrl: true,
}).extend({
  password: z.string().optional(),
  expiresAt: z.string().optional().transform((val) => val ? new Date(val) : undefined),
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
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type UserRole = "admin" | "user";
export type UserType = "internal" | "external";

export const userApprovalSchema = z.object({
  userId: z.number(),
  isApproved: z.boolean(),
  isActive: z.boolean(),
  role: z.enum(["admin", "user"]).optional(),
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

export type UserApproval = z.infer<typeof userApprovalSchema>;
export type UserInvite = z.infer<typeof userInviteSchema>;
export type InviteAccept = z.infer<typeof inviteAcceptSchema>;