import { User, InsertUser, Url, InsertUrl } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { nanoid } from "nanoid";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createUrl(userId: number, url: InsertUrl): Promise<Url>;
  getUrlByShortCode(shortCode: string): Promise<Url | undefined>;
  getUserUrls(userId: number): Promise<Url[]>;
  incrementUrlClicks(id: number): Promise<void>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private urls: Map<number, Url>;
  private currentUserId: number;
  private currentUrlId: number;
  readonly sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.urls = new Map();
    this.currentUserId = 1;
    this.currentUrlId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createUrl(userId: number, insertUrl: InsertUrl): Promise<Url> {
    const id = this.currentUrlId++;
    const shortCode = nanoid(8);
    const url: Url = {
      id,
      userId,
      shortCode,
      clicks: 0,
      createdAt: new Date(),
      ...insertUrl,
    };
    this.urls.set(id, url);
    return url;
  }

  async getUrlByShortCode(shortCode: string): Promise<Url | undefined> {
    return Array.from(this.urls.values()).find(
      (url) => url.shortCode === shortCode,
    );
  }

  async getUserUrls(userId: number): Promise<Url[]> {
    return Array.from(this.urls.values()).filter(
      (url) => url.userId === userId,
    );
  }

  async incrementUrlClicks(id: number): Promise<void> {
    const url = this.urls.get(id);
    if (url) {
      url.clicks++;
      this.urls.set(id, url);
    }
  }
}

export const storage = new MemStorage();
