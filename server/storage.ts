import { users, urls, type User, type InsertUser, type Url, type InsertUrl } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { nanoid } from "nanoid";

const PostgresSessionStore = connectPg(session);

type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createUrl(userId: number, url: InsertUrl): Promise<Url>;
  getUrlByShortCode(shortCode: string): Promise<Url | undefined>;
  getUserUrls(userId: number, limit?: number, offset?: number): Promise<Url[]>;
  getUserUrlsCount(userId: number): Promise<number>;
  incrementUrlClicks(id: number, deviceType: DeviceType, countryCode: string): Promise<void>;
  sessionStore: session.Store;
  updateUrlQrConfig(id: number, userId: number, qrConfig: any): Promise<Url | undefined>;
}

export class DatabaseStorage implements IStorage {
  readonly sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createUrl(userId: number, insertUrl: InsertUrl): Promise<Url> {
    const [url] = await db
      .insert(urls)
      .values({
        ...insertUrl,
        userId,
        shortCode: nanoid(8),
        clicks: 0,
        analytics: { devices: { desktop: 0, mobile: 0, tablet: 0 }, countries: {} }
      })
      .returning();
    return url;
  }

  async getUrlByShortCode(shortCode: string): Promise<Url | undefined> {
    const [url] = await db.select().from(urls).where(eq(urls.shortCode, shortCode));
    return url;
  }

  async getUserUrls(userId: number, limit = 10, offset = 0): Promise<Url[]> {
    return await db
      .select()
      .from(urls)
      .where(eq(urls.userId, userId))
      .orderBy(desc(urls.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getUserUrlsCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ count: urls.id.count() })
      .from(urls)
      .where(eq(urls.userId, userId));
    return Number(result?.count) || 0;
  }

  async incrementUrlClicks(id: number, deviceType: DeviceType, countryCode: string): Promise<void> {
    const [url] = await db.select().from(urls).where(eq(urls.id, id));
    if (url) {
      const analytics = url.analytics as { devices: Record<DeviceType, number>, countries: Record<string, number> };

      // Update device count
      analytics.devices[deviceType] = (analytics.devices[deviceType] || 0) + 1;

      // Update country count
      analytics.countries[countryCode] = (analytics.countries[countryCode] || 0) + 1;

      await db
        .update(urls)
        .set({ 
          clicks: url.clicks + 1,
          analytics: analytics
        })
        .where(eq(urls.id, id));
    }
  }

  async updateUrlQrConfig(id: number, userId: number, qrConfig: any): Promise<Url | undefined> {
    const [url] = await db
      .update(urls)
      .set({ qrConfig })
      .where(eq(urls.id, id))
      .where(eq(urls.userId, userId))
      .returning();
    return url;
  }
}

export const storage = new DatabaseStorage();