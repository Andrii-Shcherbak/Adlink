import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

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

// Middleware to check if user is admin
function isAdmin(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  if (!req.isAuthenticated() || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Create admin user on startup
  createAdminUser();

  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid credentials" });
        }
        // Check if user is active and approved
        if (!user.isActive) {
          return done(null, false, { message: "Account is deactivated" });
        }
        if (!user.isApproved && user.role !== "admin") {
          return done(null, false, { message: "Account pending approval" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  // Microsoft Strategy
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        callbackURL: "https://210439ba-2384-47f3-899d-fb76ff3d8138-00-3pp9yxr5bhzhm.kirk.replit.dev/api/auth/microsoft/callback",
        scope: ["user.read"],
        authority: "https://login.microsoftonline.com/organizations",
        tenant: process.env.MICROSOFT_TENANT_ID!,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email found in Microsoft profile"));
          }

          let user = await storage.getUserByEmail(email);

          if (!user) {
            const username = profile.displayName?.replace(/\s+/g, "") || email.split("@")[0];
            const firstName = profile.name?.givenName || "";
            const lastName = profile.name?.familyName || "";
            const randomPassword = randomBytes(32).toString("hex");

            user = await storage.createUser({
              username,
              password: await hashPassword(randomPassword),
              email,
              firstName,
              lastName,
              company: "",
            });
          }

          // Check if user is active and approved
          if (!user.isActive) {
            return done(null, false, { message: "Account is deactivated" });
          }
          if (!user.isApproved && user.role !== "admin") {
            return done(null, false, { message: "Account pending approval" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Authentication failed" });
      }
      req.logIn(user, async (err) => {
        if (err) {
          return next(err);
        }
        // Log successful login
        await storage.logActivity({
          userId: user.id,
          type: "login",
          metadata: {
            method: "local"
          }
        });
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.get("/api/auth/microsoft",
    passport.authenticate("microsoft", { prompt: "select_account" })
  );

  app.get("/api/auth/microsoft/callback",
    passport.authenticate("microsoft", { failureRedirect: "/auth" }),
    async (req, res) => {
      if (req.user) {
        // Log successful Microsoft login
        await storage.logActivity({
          userId: req.user.id,
          type: "login",
          metadata: {
            method: "microsoft"
          }
        });
      }
      res.redirect("/");
    }
  );

  app.post("/api/logout", (req, res, next) => {
    const userId = req.user?.id;
    req.logout(async (err) => {
      if (err) return next(err);
      if (userId) {
        // Log logout
        await storage.logActivity({
          userId,
          type: "logout",
          metadata: {}
        });
      }
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // Admin routes for user management
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
        role: 'user', // Always create regular users through admin interface
        isApproved: true, // Admins can create pre-approved users
        isActive: true,
      });
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:userId/approval", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { isApproved, isActive } = req.body;

      const user = await storage.updateUserApproval({
        userId: parseInt(userId),
        isApproved,
        isActive,
      });

      // Log user status change
      await storage.logActivity({
        userId: req.user!.id,
        type: "user_status_update",
        metadata: {
          targetUserId: parseInt(userId),
          changes: {
            isApproved,
            isActive
          }
        }
      });

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user approval status" });
    }
  });
}

// Helper function to create admin user
async function createAdminUser() {
  try {
    const adminUser = await storage.getUserByUsername('admin');
    if (!adminUser) {
      const hashedPassword = await hashPassword('admin123');
      await storage.createUser({
        username: 'admin',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@example.com',
        company: '',
        role: 'admin',
        isApproved: true,
        isActive: true
      });
      console.log('Admin user created successfully');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}