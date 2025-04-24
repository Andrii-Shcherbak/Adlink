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

interface DeviceInfo {
  type: DeviceType;
  os?: string;
  model?: string;
  brand?: string;
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByInviteToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createUrl(userId: number, url: InsertUrl): Promise<Url>;
  getUrlByShortCode(shortCode: string, userId?: number): Promise<Url | undefined>;
  getUserUrls(userId: number, limit?: number, offset?: number): Promise<Url[]>;
  getUserUrlsCount(userId: number): Promise<number>;
  incrementUrlClicks(id: number, userId: number, deviceType: DeviceType, countryInfo: CountryInfo, referrer: string, deviceInfo?: DeviceInfo): Promise<void>;
  sessionStore: session.Store;
  updateUrlQrConfig(id: number, userId: number, qrConfig: any): Promise<Url | undefined>;
  updateUrl(id: number, userId: number, update: Partial<Url>): Promise<Url>;
  deleteUrl(id: number, userId: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  updateUserApproval(approval: UserApproval): Promise<User>;
  
  // Invite-related methods
  createInvitation(inviteData: { email: string, firstName: string, lastName: string, company?: string }): Promise<{ user: User, token: string }>;
  acceptInvitation(token: string, userData: { username: string, password: string }): Promise<User>;
  
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

  async getUserByInviteToken(token: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.inviteToken, token));
      return user;
    } catch (error) {
      console.error('Error getting user by invite token:', error);
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
    referrer: string,
    deviceInfo?: DeviceInfo
  ): Promise<void> {
    const [url] = await db
      .select()
      .from(urls)
      .where(and(eq(urls.id, id), eq(urls.userId, userId)));

    if (!url) {
      throw new Error("URL not found or unauthorized");
    }

    // Clone the analytics to avoid direct mutation of db result
    let analytics = JSON.parse(JSON.stringify(url.analytics || {}));

    // Initialize defaults if not present
    analytics.devices = analytics.devices || { desktop: 0, mobile: 0, tablet: 0 };
    analytics.countries = analytics.countries || {};
    analytics.referrers = analytics.referrers || {};
    analytics.deviceDetails = analytics.deviceDetails || { os: {}, models: {}, brands: {} };

    // Update device count
    analytics.devices[deviceType] = (analytics.devices[deviceType] || 0) + 1;
    
    // Update detailed device information if available
    if (deviceInfo) {
      // Track OS information
      if (deviceInfo.os) {
        analytics.deviceDetails.os[deviceInfo.os] = 
          (analytics.deviceDetails.os[deviceInfo.os] || 0) + 1;
      }
      
      // Track device model information
      if (deviceInfo.model) {
        analytics.deviceDetails.models[deviceInfo.model] = 
          (analytics.deviceDetails.models[deviceInfo.model] || 0) + 1;
      }
      
      // Track device brand information
      if (deviceInfo.brand) {
        analytics.deviceDetails.brands[deviceInfo.brand] = 
          (analytics.deviceDetails.brands[deviceInfo.brand] || 0) + 1;
      }
    }
    
    // Completely rebuild countries structure if needed
    const countryEntry = analytics.countries[countryInfo.code];
    
    // Create a completely new analytics structure with proper typing
    const newAnalytics: {
      devices: Record<DeviceType, number>;
      countries: Record<string, { count: number; name: string; cities: Record<string, number> }>;
      referrers: Record<string, number>;
      deviceDetails: {
        os: Record<string, number>;
        models: Record<string, number>;
        brands: Record<string, number>;
      };
    } = {
      devices: { ...analytics.devices },
      countries: {},
      referrers: { ...analytics.referrers },
      deviceDetails: { 
        os: analytics.deviceDetails?.os ? { ...analytics.deviceDetails.os } : {},
        models: analytics.deviceDetails?.models ? { ...analytics.deviceDetails.models } : {},
        brands: analytics.deviceDetails?.brands ? { ...analytics.deviceDetails.brands } : {}
      }
    };
    
    // Copy and convert all countries data to new format
    if (analytics.countries && typeof analytics.countries === 'object') {
      Object.entries(analytics.countries).forEach(([code, entry]) => {
        if (typeof entry === 'number') {
          // Convert old format to new format
          newAnalytics.countries[code] = {
            count: entry,
            name: code,
            cities: {}
          };
        } else if (entry && typeof entry === 'object') {
          // Already in new format, just copy it
          const countryData = entry as { count?: number; name?: string; cities?: Record<string, number> };
          newAnalytics.countries[code] = { 
            count: countryData.count || 0,
            name: countryData.name || code,
            cities: countryData.cities || {}
          };
        }
      });
    }
    
    // Make sure the current country exists
    if (!newAnalytics.countries[countryInfo.code]) {
      newAnalytics.countries[countryInfo.code] = {
        count: 0,
        name: countryInfo.name,
        cities: {}
      };
    }
    
    // Increment the count for this country
    newAnalytics.countries[countryInfo.code].count += 1;
    
    // Replace the analytics object with our new one
    analytics = newAnalytics;
    
    // Update city data if available
    if (countryInfo.city) {
      const cityName = countryInfo.city.toLowerCase();
      if (!analytics.countries[countryInfo.code].cities) {
        analytics.countries[countryInfo.code].cities = {};
      }
      
      analytics.countries[countryInfo.code].cities[cityName] = 
        (analytics.countries[countryInfo.code].cities[cityName] || 0) + 1;
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
  
  async createInvitation(inviteData: { email: string; firstName: string; lastName: string; company?: string }): Promise<{ user: User; token: string }> {
    try {
      // Generate a random token
      const token = nanoid(32);
      
      // Check if a user with this email already exists
      const existingUser = await this.getUserByEmail(inviteData.email);
      if (existingUser) {
        throw new Error("A user with this email already exists");
      }
      
      // Create a placeholder user with the invite token
      const [user] = await db.insert(users).values({
        username: `invite_${nanoid(8)}`, // Temporary username until accepted
        password: nanoid(32), // Temporary password until accepted
        email: inviteData.email,
        firstName: inviteData.firstName,
        lastName: inviteData.lastName,
        company: inviteData.company || "",
        role: "user",
        isApproved: true, // Pre-approved since it's an admin-created invite
        isActive: false, // Not active until invitation is accepted
        inviteToken: token,
        inviteSentAt: new Date()
      }).returning();
      
      return { user, token };
    } catch (error) {
      console.error('Error creating invitation:', error);
      throw error;
    }
  }
  
  async acceptInvitation(token: string, userData: { username: string; password: string }): Promise<User> {
    try {
      // Find the invitation
      const user = await this.getUserByInviteToken(token);
      if (!user) {
        throw new Error("Invalid or expired invitation token");
      }
      
      // Check if the invitation has already been accepted
      if (user.inviteAcceptedAt) {
        throw new Error("This invitation has already been accepted");
      }
      
      // Check if username is already taken by another user
      const existingUser = await this.getUserByUsername(userData.username);
      if (existingUser && existingUser.id !== user.id) {
        throw new Error("This username is already taken");
      }
      
      // Update the user with the provided username and password
      const [updatedUser] = await db.update(users)
        .set({
          username: userData.username,
          password: userData.password, // Note: This should be hashed before calling this method
          isActive: true,
          inviteAcceptedAt: new Date(),
          // Clear the invite token to prevent reuse
          inviteToken: null
        })
        .where(eq(users.id, user.id))
        .returning();
      
      if (!updatedUser) {
        throw new Error("Failed to update user");
      }
      
      return updatedUser;
    } catch (error) {
      console.error('Error accepting invitation:', error);
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