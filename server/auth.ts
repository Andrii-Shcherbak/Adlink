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
        console.error('Local auth error:', error);
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
        callbackURL: "/api/auth/microsoft/callback",
        scope: ["user.read"],
        tenant: "common",
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
              role: "user",
              isApproved: true,
              isActive: true
            });
          }

          // Check if user is active
          if (!user.isActive) {
            return done(null, false, { message: "Account is deactivated" });
          }

          return done(null, user);
        } catch (error) {
          console.error('Microsoft auth error:', error);
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
      console.error('Deserialize error:', error);
      done(error, null);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: "Authentication failed" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      req.logIn(user, async (err) => {
        if (err) {
          console.error('Login session error:', err);
          return res.status(500).json({ error: "Failed to establish session" });
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
    passport.authenticate("microsoft", {
      successRedirect: "/",
      failureRedirect: "/auth"
    })
  );

  app.post("/api/logout", (req, res, next) => {
    const userId = req.user?.id;
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: "Logout failed" });
      }
      if (userId) {
        // Log logout
        storage.logActivity({
          userId,
          type: "logout",
          metadata: {}
        }).catch(console.error);
      }
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
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