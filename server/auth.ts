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
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  // Microsoft Strategy
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID!,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
        // Use the full callback URL as configured in Azure AD
        callbackURL: "https://210439ba-2384-47f3-899d-fb76ff3d8138-00-3pp9yxr5bhzhm.kirk.replit.dev/api/auth/microsoft/callback",
        scope: ["user.read"],
        // Add tenant-specific authority URL
        authority: "https://login.microsoftonline.com/organizations",
        // Ensure we're using tenant-specific endpoint
        tenant: process.env.MICROSOFT_TENANT_ID!,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user exists by email
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email found in Microsoft profile"));
          }

          let user = await storage.getUserByEmail(email);

          if (!user) {
            // Create new user if doesn't exist
            const username = profile.displayName?.replace(/\s+/g, "") || email.split("@")[0];
            const firstName = profile.name?.givenName || "";
            const lastName = profile.name?.familyName || "";

            // Generate a random password for Microsoft users
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

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  // Microsoft OAuth routes
  app.get("/api/auth/microsoft",
    passport.authenticate("microsoft", { prompt: "select_account" })
  );

  app.get("/api/auth/microsoft/callback",
    passport.authenticate("microsoft", { failureRedirect: "/auth" }),
    (req, res) => {
      res.redirect("/");
    }
  );

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}