import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const urls = pgTable("urls", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  originalUrl: text("original_url").notNull(),
  shortCode: text("short_code").notNull().unique(),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  analytics: jsonb("analytics").notNull().default({
    devices: {
      desktop: 0,
      mobile: 0,
      tablet: 0,
    },
    countries: {},
  }),
  qrConfig: jsonb("qr_config").notNull().default({
    fgColor: "#000000",
    bgColor: "#FFFFFF",
    includeMargin: true,
    logoUrl: "",
    qrStyle: "dots",
    cornerStyle: "square",
    frameStyle: "none",
    pattern: "squares",
    cornerDotColor: "#000000",
    cornerSquareColor: "#000000",
    frameColor: "#000000",
  }),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertUrlSchema = createInsertSchema(urls).pick({
  originalUrl: true,
});

export const qrConfigSchema = z.object({
  fgColor: z.string(),
  bgColor: z.string(),
  includeMargin: z.boolean(),
  logoUrl: z.string(),
  qrStyle: z.enum(["dots", "squares"]),
  cornerStyle: z.enum(["square", "dot", "extra-rounded"]),
  frameStyle: z.enum(["none", "simple", "dots"]),
  pattern: z.enum(["squares", "dots", "rounded", "classy", "elegant"]),
  cornerDotColor: z.string().default("#000000"),
  cornerSquareColor: z.string().default("#000000"),
  frameColor: z.string().default("#000000"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Url = typeof urls.$inferSelect;
export type InsertUrl = z.infer<typeof insertUrlSchema>;
export type QrConfig = z.infer<typeof qrConfigSchema>;