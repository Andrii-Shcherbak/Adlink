import { 
  users, urls, activities, assetFolders, assetFiles,
  type User, type InsertUser, type Url, type InsertUrl, 
  type UserApproval, type Activity, type InsertActivity,
  type AssetFolder, type InsertAssetFolder, type AssetFile, type InsertAssetFile
} from "@shared/schema";
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
  deleteUser(userId: number): Promise<void>;
  
  // Invite-related methods
  createInvitation(inviteData: { email: string, firstName: string, lastName: string, company?: string, userType?: 'internal' | 'external', role?: 'admin' | 'user' }): Promise<{ user: User, token: string }>;
  acceptInvitation(token: string, userData: { username: string, password: string }): Promise<User>;
  
  logActivity(activity: InsertActivity): Promise<Activity>;
  getUserActivities(userId: number, limit?: number, offset?: number): Promise<Activity[]>;
  getUserActivitiesCount(userId: number): Promise<number>;
  getAllActivities(limit?: number, offset?: number): Promise<Activity[]>;
  getAllActivitiesCount(): Promise<number>;
  
  // Digital Asset Management methods
  createFolder(folder: InsertAssetFolder): Promise<AssetFolder>;
  getFolderById(id: number, userId: number): Promise<AssetFolder | undefined>;
  getUserFolders(userId: number): Promise<AssetFolder[]>;
  updateFolder(id: number, userId: number, data: Partial<AssetFolder>): Promise<AssetFolder | undefined>;
  deleteFolder(id: number, userId: number): Promise<void>;
  
  createFile(file: InsertAssetFile): Promise<AssetFile>;
  getFileById(id: number, userId: number): Promise<AssetFile | undefined>;
  getUserFiles(userId: number, folderId?: number | null): Promise<AssetFile[]>;
  updateFile(id: number, userId: number, data: Partial<AssetFile>): Promise<AssetFile | undefined>;
  deleteFile(id: number, userId: number): Promise<void>;
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
      // Perform case-insensitive email lookup
      // First normalize the email to lowercase
      const normalizedEmail = email.toLowerCase();
      
      // Get all users and compare emails in a case-insensitive manner
      const allUsers = await db.select().from(users);
      const matchingUser = allUsers.find(user => 
        user.email && user.email.toLowerCase() === normalizedEmail
      );
      
      return matchingUser;
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
        role: insertUser.role ?? 'user',
        isApproved: insertUser.isApproved ?? false,
        isActive: insertUser.isActive ?? true
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
    // Lock the row so simultaneous clicks queue up instead of overwriting each other's counts
    await db.transaction(async (tx) => {
      const [url] = await tx
        .select()
        .from(urls)
        .where(and(eq(urls.id, id), eq(urls.userId, userId)))
        .for("update");

      if (!url) {
        throw new Error("URL not found or unauthorized");
      }

      if (!countryInfo.code) {
        countryInfo = { code: 'UNKNOWN', name: 'Unknown' };
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

      await tx
        .update(urls)
        .set({
          clicks: sql`${urls.clicks} + 1`,
          analytics: analytics
        })
        .where(and(eq(urls.id, id), eq(urls.userId, userId)));
    });
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
      // Build the update object dynamically to include optional fields
      const updateData: Partial<User> = {
        isApproved: approval.isApproved,
        isActive: approval.isActive
      };
      
      // Add optional fields if provided
      if (approval.role) {
        updateData.role = approval.role;
      }
      
      if (approval.userType) {
        updateData.userType = approval.userType;
      }
      
      const [user] = await db
        .update(users)
        .set(updateData)
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
  
  async deleteUser(userId: number): Promise<void> {
    try {
      console.log(`Starting deletion of user with ID: ${userId}`);
      
      // Verify user exists before deleting
      const userExists = await this.getUser(userId);
      if (!userExists) {
        console.log(`User with ID ${userId} not found`);
        throw new Error(`User with ID ${userId} not found`);
      }
      
      console.log(`User exists, proceeding with deletion of user ${userExists.username}`);
      
      // First, delete user's URLs to maintain referential integrity
      const deletedUrlsResult = await db
        .delete(urls)
        .where(eq(urls.userId, userId));
      console.log(`Deleted user URLs: ${JSON.stringify(deletedUrlsResult)}`);
      
      // Delete any activities associated with this user
      const deletedActivitiesResult = await db
        .delete(activities)
        .where(eq(activities.userId, userId));
      console.log(`Deleted user activities: ${JSON.stringify(deletedActivitiesResult)}`);
      
      // Finally, delete the user
      const deletedUserResult = await db
        .delete(users)
        .where(eq(users.id, userId));
      console.log(`Deleted user result: ${JSON.stringify(deletedUserResult)}`);
      
      if (!deletedUserResult) {
        console.error(`Failed to delete user with ID ${userId}`);
        throw new Error("User not found or could not be deleted");
      }
      
      console.log(`Successfully deleted user with ID ${userId}`);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
  
  async createInvitation(inviteData: { 
    email: string; 
    firstName: string; 
    lastName: string; 
    company?: string;
    userType?: 'internal' | 'external';
    role?: 'admin' | 'user';
  }): Promise<{ user: User; token: string }> {
    try {
      // Generate a random token
      const token = nanoid(32);
      
      // Check if a user with this email already exists
      const existingUser = await this.getUserByEmail(inviteData.email);
      if (existingUser) {
        throw new Error("A user with this email already exists");
      }
      
      // Determine user type and role with defaults
      const userType = inviteData.userType || 'external';
      const role = inviteData.role || 'user';
      
      // For internal users, we don't require username and password since they'll use Microsoft auth
      const username = userType === 'internal' ? null : `invite_${nanoid(8)}`; // Temp username for external
      const password = userType === 'internal' ? null : nanoid(32); // Temp password for external
      
      // Create a placeholder user with the invite token
      const [user] = await db.insert(users).values({
        username,
        password,
        email: inviteData.email,
        firstName: inviteData.firstName,
        lastName: inviteData.lastName,
        company: inviteData.company || "",
        role,
        userType,
        isApproved: true, // Pre-approved since it's an admin-created invite
        isActive: true, // Mark as active by default so users can log in immediately
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
      
      // Internal users (Microsoft auth) don't need username/password
      const userType = user.userType || 'external';
      
      // Only validate username for external users
      if (userType === 'external') {
        // Check if username is already taken by another user
        const existingUser = await this.getUserByUsername(userData.username);
        if (existingUser && existingUser.id !== user.id) {
          throw new Error("This username is already taken");
        }
      }
      
      // Prepare the update data based on user type
      const updateData: any = {
        isActive: true,
        inviteAcceptedAt: new Date(),
        inviteToken: null // Clear the invite token to prevent reuse
      };
      
      // Only set username and password for external users
      if (userType === 'external') {
        updateData.username = userData.username;
        updateData.password = userData.password; // This should be hashed before calling this method
      }
      
      // Update the user with the provided data
      const [updatedUser] = await db.update(users)
        .set(updateData)
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

  // Digital Asset Management methods implementation
  
  async createFolder(folder: InsertAssetFolder): Promise<AssetFolder> {
    try {
      // Ensure userId is provided
      if (!folder.userId) {
        throw new Error('User ID is required');
      }
      
      // Normalize and validate the path
      let folderPath = folder.path || '/';
      if (!folderPath.startsWith('/')) folderPath = `/${folderPath}`;
      if (!folderPath.endsWith('/')) folderPath = `${folderPath}/`;
      
      // Generate a unique path based on parent and name
      if (folder.parentId) {
        const parent = await this.getFolderById(folder.parentId, folder.userId);
        if (!parent) {
          throw new Error('Parent folder not found');
        }
        folderPath = `${parent.path}${folder.name}/`;
      }
      
      const [newFolder] = await db
        .insert(assetFolders)
        .values({
          userId: folder.userId,
          name: folder.name,
          parentId: folder.parentId,
          path: folderPath,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
        
      return newFolder;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }
  
  async getFolderById(id: number, userId: number): Promise<AssetFolder | undefined> {
    try {
      const [folder] = await db
        .select()
        .from(assetFolders)
        .where(and(eq(assetFolders.id, id), eq(assetFolders.userId, userId)));
      return folder;
    } catch (error) {
      console.error('Error getting folder by ID:', error);
      return undefined;
    }
  }
  
  async getUserFolders(userId: number): Promise<AssetFolder[]> {
    try {
      return await db
        .select()
        .from(assetFolders)
        .where(eq(assetFolders.userId, userId))
        .orderBy(assetFolders.path);
    } catch (error) {
      console.error('Error getting user folders:', error);
      return [];
    }
  }
  
  async updateFolder(id: number, userId: number, data: Partial<AssetFolder>): Promise<AssetFolder | undefined> {
    try {
      // Cannot update path directly, it must be generated based on parent and name
      const updateData: Partial<AssetFolder> = {
        ...data,
        updatedAt: new Date()
      };
      
      // Remove path if it's there - we'll recalculate it
      delete updateData.path;
      
      // If name or parentId changes, we need to recalculate path
      if (data.name || data.parentId !== undefined) {
        const folder = await this.getFolderById(id, userId);
        if (!folder) {
          throw new Error('Folder not found');
        }
        
        let newPath = '/';
        const newParentId = data.parentId !== undefined ? data.parentId : folder.parentId;
        const newName = data.name || folder.name;
        
        if (newParentId) {
          const parent = await this.getFolderById(newParentId, userId);
          if (!parent) {
            throw new Error('Parent folder not found');
          }
          newPath = `${parent.path}${newName}/`;
        } else {
          newPath = `/${newName}/`;
        }
        
        updateData.path = newPath;
      }
      
      const [updatedFolder] = await db
        .update(assetFolders)
        .set(updateData)
        .where(and(eq(assetFolders.id, id), eq(assetFolders.userId, userId)))
        .returning();
        
      return updatedFolder;
    } catch (error) {
      console.error('Error updating folder:', error);
      return undefined;
    }
  }
  
  async deleteFolder(id: number, userId: number): Promise<void> {
    try {
      // First, get the folder to check if it exists and get the path
      const folder = await this.getFolderById(id, userId);
      if (!folder) {
        throw new Error('Folder not found');
      }
      
      // Check if it has subfolders
      const subfolders = await db
        .select()
        .from(assetFolders)
        .where(eq(assetFolders.parentId, id));
        
      if (subfolders.length > 0) {
        throw new Error('Cannot delete folder with subfolders');
      }
      
      // Get and delete all files in the folder
      const files = await db
        .select()
        .from(assetFiles)
        .where(eq(assetFiles.folderId, id));
        
      for (const file of files) {
        await this.deleteFile(file.id, userId);
      }
      
      // Finally, delete the folder
      await db
        .delete(assetFolders)
        .where(and(eq(assetFolders.id, id), eq(assetFolders.userId, userId)));
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  }
  
  async createFile(file: InsertAssetFile): Promise<AssetFile> {
    try {
      // Validate folder belongs to user if folderID is provided
      if (file.folderId) {
        const folder = await this.getFolderById(file.folderId, file.userId);
        if (!folder) {
          throw new Error('Folder not found or unauthorized');
        }
      }
      
      const [newFile] = await db
        .insert(assetFiles)
        .values({
          ...file,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
        
      return newFile;
    } catch (error) {
      console.error('Error creating file:', error);
      throw error;
    }
  }
  
  async getFileById(id: number, userId: number): Promise<AssetFile | undefined> {
    try {
      const [file] = await db
        .select()
        .from(assetFiles)
        .where(and(eq(assetFiles.id, id), eq(assetFiles.userId, userId)));
      return file;
    } catch (error) {
      console.error('Error getting file by ID:', error);
      return undefined;
    }
  }
  
  async getUserFiles(userId: number, folderId: number | null | undefined = undefined): Promise<AssetFile[]> {
    try {
      console.log(`Storage: Getting files for user ${userId} in folder:`, folderId);
      
      // If no folder specified, return all files
      if (folderId === undefined) {
        return await db
          .select()
          .from(assetFiles)
          .where(eq(assetFiles.userId, userId))
          .orderBy(assetFiles.name);
      }
      
      // Get files without a folder (root level)
      if (folderId === null) {
        return await db
          .select()
          .from(assetFiles)
          .where(and(
            eq(assetFiles.userId, userId), 
            sql`${assetFiles.folderId} IS NULL`
          ))
          .orderBy(assetFiles.name);
      }
      
      // Get files in a specific folder
      return await db
        .select()
        .from(assetFiles)
        .where(and(
          eq(assetFiles.userId, userId),
          eq(assetFiles.folderId, folderId)
        ))
        .orderBy(assetFiles.name);
    } catch (error) {
      console.error('Error getting user files:', error);
      return [];
    }
  }
  
  async updateFile(id: number, userId: number, data: Partial<AssetFile>): Promise<AssetFile | undefined> {
    try {
      // If changing folder, check it belongs to the user
      if (data.folderId !== undefined) {
        if (data.folderId !== null) {
          const folder = await this.getFolderById(data.folderId, userId);
          if (!folder) {
            throw new Error('New folder not found or unauthorized');
          }
        }
      }
      
      const [updatedFile] = await db
        .update(assetFiles)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(and(eq(assetFiles.id, id), eq(assetFiles.userId, userId)))
        .returning();
        
      return updatedFile;
    } catch (error) {
      console.error('Error updating file:', error);
      return undefined;
    }
  }
  
  async deleteFile(id: number, userId: number): Promise<void> {
    try {
      // Get the file to check if it exists and belongs to the user
      const file = await this.getFileById(id, userId);
      if (!file) {
        throw new Error('File not found or unauthorized');
      }
      
      const { fileStorage } = await import('./services/file-storage');
      
      // Delete the actual file from storage
      if (file.storageFileName) {
        try {
          await fileStorage.deleteAssetFile(file.storageFileName);
        } catch (storageError) {
          console.error('Error deleting file from storage:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }
      
      // Delete the database record
      await db
        .delete(assetFiles)
        .where(and(eq(assetFiles.id, id), eq(assetFiles.userId, userId)));
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();