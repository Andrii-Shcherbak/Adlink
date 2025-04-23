import { users, urls, activities, type User, type InsertUser, type Url, type InsertUrl, type UserApproval, type Activity, type InsertActivity } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { nanoid } from "nanoid";
import { CountryInfo } from "./routes";

const PostgresSessionStore = connectPg(session);

type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createUrl(userId: number, url: InsertUrl): Promise<Url>;
  getUrlByShortCode(shortCode: string, userId?: number): Promise<Url | undefined>;
  getUserUrls(userId: number, limit?: number, offset?: number): Promise<Url[]>;
  getUserUrlsCount(userId: number): Promise<number>;
  incrementUrlClicks(id: number, userId: number, deviceType: DeviceType, countryInfo: CountryInfo, referrer: string): Promise<void>;
  sessionStore: session.Store;
  updateUrlQrConfig(id: number, userId: number, qrConfig: any): Promise<Url | undefined>;
  updateUrl(id: number, userId: number, update: Partial<Url>): Promise<Url>;
  deleteUrl(id: number, userId: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUserApproval(approval: UserApproval): Promise<User>;

  logActivity(activity: InsertActivity): Promise<Activity>;
  getUserActivities(userId: number, limit?: number, offset?: number): Promise<Activity[]>;
  getUserActivitiesCount(userId: number): Promise<number>;
  getAllActivities(limit?: number, offset?: number): Promise<Activity[]>;
  getAllActivitiesCount(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  readonly sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
      tableName: 'session'
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values({
        ...insertUser,
        role: 'user',
        isApproved: false,
        isActive: true
      }).returning();
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async createUrl(userId: number, insertUrl: InsertUrl): Promise<Url> {
    const [url] = await db
      .insert(urls)
      .values({
        ...insertUrl,
        userId,
        shortCode: nanoid(8),
        clicks: 0,
        analytics: {
          devices: { desktop: 0, mobile: 0, tablet: 0 },
          countries: {},
          referrers: {},
        }
      })
      .returning();
    return url;
  }

  async getUrlByShortCode(shortCode: string, userId?: number): Promise<Url | undefined> {
    const conditions = [eq(urls.shortCode, shortCode)];
    if (userId !== undefined) {
      conditions.push(eq(urls.userId, userId));
    }

    const [url] = await db
      .select()
      .from(urls)
      .where(and(...conditions));

    return url;
  }

  async getUserUrls(userId: number, limit = 10, offset = 0): Promise<Url[]> {
    const userUrls = await db
      .select()
      .from(urls)
      .where(eq(urls.userId, userId))
      .orderBy(desc(urls.createdAt))
      .limit(limit)
      .offset(offset);

    return userUrls;
  }

  async getUserUrlsCount(userId: number): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(urls)
      .where(eq(urls.userId, userId));
    return Number(result?.count) || 0;
  }

  async incrementUrlClicks(
    id: number, 
    userId: number, 
    deviceType: DeviceType, 
    countryInfo: { code: string; name: string; city?: string }, 
    referrer: string
  ): Promise<void> {
    const [url] = await db
      .select()
      .from(urls)
      .where(and(eq(urls.id, id), eq(urls.userId, userId)));

    if (!url) {
      throw new Error("URL not found or unauthorized");
    }

    const analytics = url.analytics as {
      devices: Record<DeviceType, number>,
      countries: Record<string, { count: number, name: string, cities?: Record<string, number> }>,
      referrers: Record<string, number>
    };

    analytics.devices = analytics.devices || { desktop: 0, mobile: 0, tablet: 0 };
    analytics.countries = analytics.countries || {};
    analytics.referrers = analytics.referrers || {};

    // Update device count
    analytics.devices[deviceType] = (analytics.devices[deviceType] || 0) + 1;
    
    // Initialize or update country data
    if (!analytics.countries[countryInfo.code]) {
      analytics.countries[countryInfo.code] = {
        count: 0,
        name: countryInfo.name,
        cities: {}
      };
    }
    
    // Increment country count
    if (analytics.countries[countryInfo.code]) {
      analytics.countries[countryInfo.code].count += 1;
    }
    
    // Update city data if available
    if (countryInfo.city) {
      const countryData = analytics.countries[countryInfo.code];
      if (countryData) {
        countryData.cities = countryData.cities || {};
        if (countryData.cities && countryInfo.city) {
          countryData.cities[countryInfo.city] = (countryData.cities[countryInfo.city] || 0) + 1;
        }
      }
    }
    
    // Update referrer data
    analytics.referrers[referrer] = (analytics.referrers[referrer] || 0) + 1;

    await db
      .update(urls)
      .set({
        clicks: url.clicks + 1,
        analytics: analytics
      })
      .where(and(eq(urls.id, id), eq(urls.userId, userId)));
  }

  async updateUrlQrConfig(id: number, userId: number, qrConfig: any): Promise<Url | undefined> {
    const [url] = await db
      .update(urls)
      .set({ qrConfig })
      .where(and(eq(urls.id, id), eq(urls.userId, userId)))
      .returning();
    return url;
  }

  async deleteUrl(id: number, userId: number): Promise<void> {
    await db
      .delete(urls)
      .where(and(eq(urls.id, id), eq(urls.userId, userId)));
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  async updateUserApproval(approval: UserApproval): Promise<User> {
    try {
      const [user] = await db
        .update(users)
        .set({
          isApproved: approval.isApproved,
          isActive: approval.isActive,
        })
        .where(eq(users.id, approval.userId))
        .returning();

      if (!user) {
        throw new Error("User not found");
      }

      return user;
    } catch (error) {
      console.error('Error updating user approval:', error);
      throw error;
    }
  }

  async logActivity(activity: InsertActivity): Promise<Activity> {
    try {
      const [newActivity] = await db
        .insert(activities)
        .values(activity)
        .returning();
      return newActivity;
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  }

  async getUserActivities(userId: number, limit = 10, offset = 0): Promise<Activity[]> {
    try {
      return await db
        .select()
        .from(activities)
        .where(eq(activities.userId, userId))
        .orderBy(desc(activities.timestamp))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error getting user activities:', error);
      throw error;
    }
  }

  async getUserActivitiesCount(userId: number): Promise<number> {
    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(activities)
        .where(eq(activities.userId, userId));
      return Number(result?.count) || 0;
    } catch (error) {
      console.error('Error getting user activities count:', error);
      throw error;
    }
  }

  async getAllActivities(limit = 10, offset = 0): Promise<Activity[]> {
    try {
      return await db
        .select({
          id: activities.id,
          userId: activities.userId,
          type: activities.type,
          timestamp: activities.timestamp,
          metadata: activities.metadata,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(activities)
        .leftJoin(users, eq(activities.userId, users.id))
        .orderBy(desc(activities.timestamp))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error getting all activities:', error);
      throw error;
    }
  }

  async getAllActivitiesCount(): Promise<number> {
    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(activities);
      return Number(result?.count) || 0;
    } catch (error) {
      console.error('Error getting all activities count:', error);
      throw error;
    }
  }
  async updateUrl(id: number, userId: number, update: Partial<Url>): Promise<Url> {
    try {
      const [url] = await db
        .update(urls)
        .set(update)
        .where(and(eq(urls.id, id), eq(urls.userId, userId)))
        .returning();

      if (!url) {
        throw new Error("URL not found");
      }

      return url;
    } catch (error) {
      console.error('Error updating URL:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();