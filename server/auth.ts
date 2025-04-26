import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, users } from "@shared/schema";
import { getAuthDomain } from "./utils/appConfig";
import { emailService } from "./services/email-service";
import { db } from "./db";
import { eq } from "drizzle-orm";

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
        callbackURL: `${getAuthDomain()}/api/auth/microsoft/callback`,
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

          // Special handling for Microsoft auth
          console.log(`Microsoft auth: Looking up user by email ${email}`);
          
          // Search for all user accounts with this email to handle invitations properly
          let user = await storage.getUserByEmail(email);
          
          if (!user) {
            console.log(`Microsoft auth: No existing user found for email ${email}, creating new user`);
            // For Microsoft auth users, we automatically create them as internal users
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
              userType: 'internal', // Set user type as internal for Microsoft auth
              role: 'user', // Default role is user
              isApproved: true // Auto-approve Microsoft users since they're authenticated by the organization
            });
            
            // Log activity for new Microsoft user
            await storage.logActivity({
              userId: user.id,
              type: 'user_created',
              metadata: { 
                method: 'microsoft',
                email: user.email
              }
            });
          } else {
            console.log(`Microsoft auth: Found existing user for email ${email}, id: ${user.id}`);
            
            if (user.userType !== 'internal') {
              console.log(`Microsoft auth: Updating user ${user.id} to internal type`);
              // If a user with this email exists but is not marked as internal,
              // update them to be an internal user using the storage interface
              const updatedUser = await storage.updateUserApproval({
                userId: user.id,
                isApproved: true,
                isActive: true,
                userType: 'internal'
              });
              
              if (updatedUser) {
                user = updatedUser;
              }
            }
            
            // Always set microsoftId if not already set
            if (!user.microsoftId && profile.id) {
              console.log(`Microsoft auth: Setting Microsoft ID for user ${user.id}`);
              try {
                const [updatedUser] = await db.update(users)
                  .set({ microsoftId: profile.id })
                  .where(eq(users.id, user.id))
                  .returning();
                  
                if (updatedUser) {
                  user = updatedUser;
                }
              } catch (err) {
                console.error('Error updating Microsoft ID:', err);
              }
            }
          }
          
          // Check if this is an invited user that hasn't accepted their invitation yet
          if (user.inviteToken) {
            console.log(`Microsoft auth: User ${user.id} has an active invitation, accepting automatically`);
            // Accept the invitation automatically for Microsoft users
            try {
              const acceptedUser = await db.update(users)
                .set({
                  inviteAcceptedAt: new Date(),
                  inviteToken: null, // Clear the invite token
                  isActive: true,
                  isApproved: true // Ensure the user is approved
                })
                .where(eq(users.id, user.id))
                .returning();
                
              if (acceptedUser.length > 0) {
                user = acceptedUser[0];
                
                // Log that the invitation was accepted via Microsoft login
                await storage.logActivity({
                  userId: user.id,
                  type: 'invitation_accepted',
                  metadata: { method: 'microsoft' }
                });
                
                console.log(`Microsoft auth: Invitation accepted successfully for user ${user.id}`);
              }
            } catch (err) {
              console.error('Error automatically accepting invitation for Microsoft user:', err);
              // Continue with login even if invitation acceptance fails
            }
          }

          // Check if user is active and approved (for both existing and new users)
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
    (req, res, next) => {
      passport.authenticate("microsoft", (err, user, info) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          // Store the error message in the session
          req.session.authMessage = info?.message || "Authentication failed";
          return res.redirect("/auth-status");
        }
        req.logIn(user, async (err) => {
          if (err) {
            return next(err);
          }
          // Log successful Microsoft login
          await storage.logActivity({
            userId: user.id,
            type: "login",
            metadata: {
              method: "microsoft"
            }
          });
          res.redirect("/");
        });
      })(req, res, next);
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

  // Add this route to get auth status message
  app.get("/api/auth/status", (req, res) => {
    const message = req.session.authMessage;
    // Clear the message after sending it
    delete req.session.authMessage;
    res.json({ message });
  });

  // Invite management routes
  app.post("/api/invites", isAdmin, async (req, res) => {
    try {
      const inviteData = req.body;
      
      // Validate the invite data
      if (!inviteData.email || !inviteData.firstName || !inviteData.lastName) {
        return res.status(400).json({ error: "Email, first name, and last name are required" });
      }
      
      // Validate user type and role
      if (inviteData.userType && !['internal', 'external'].includes(inviteData.userType)) {
        return res.status(400).json({ error: "User type must be either 'internal' or 'external'" });
      }
      
      if (inviteData.role && !['admin', 'user'].includes(inviteData.role)) {
        return res.status(400).json({ error: "Role must be either 'admin' or 'user'" });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(inviteData.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already registered" });
      }
      
      // Create invitation with user type and role
      const { user, token } = await storage.createInvitation({
        email: inviteData.email,
        firstName: inviteData.firstName,
        lastName: inviteData.lastName,
        company: inviteData.company,
        userType: inviteData.userType,
        role: inviteData.role
      });
      
      // Send invitation email
      const emailSent = await emailService.sendInvitation(
        inviteData.email,
        inviteData.firstName,
        inviteData.lastName,
        token
      );
      
      if (!emailSent && !process.env.SENDGRID_API_KEY) {
        return res.status(400).json({ 
          error: "SendGrid API key is missing. Please add a SENDGRID_API_KEY to your environment variables." 
        });
      } else if (!emailSent) {
        // If email fails for other reasons, return success but with a warning
        // Also include the token so it can be manually shared
        return res.status(201).json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          },
          token: token, // Include token for manual sharing
          warning: "Invitation created but email could not be sent. Please check your email configuration."
        });
      }
      
      // Log activity
      await storage.logActivity({
        userId: req.user!.id,
        type: 'user_invited',
        metadata: { 
          email: inviteData.email,
          invitedBy: req.user!.username
        }
      });
      
      return res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        message: "Invitation sent successfully"
      });
    } catch (error) {
      console.error('Error creating invitation:', error);
      return res.status(500).json({ 
        error: error.message || "Server error during invitation creation" 
      });
    }
  });
  
  // Accept invitation (public route)
  app.post("/api/invites/accept", async (req, res) => {
    try {
      const { token, username, password } = req.body;
      
      if (!token || !username || !password) {
        return res.status(400).json({ error: "Token, username, and password are required" });
      }
      
      // Find the invitation
      const user = await storage.getUserByInviteToken(token);
      if (!user) {
        return res.status(400).json({ error: "Invalid or expired invitation token" });
      }
      
      // Check if the invitation has already been accepted
      if (user.inviteAcceptedAt) {
        return res.status(400).json({ error: "This invitation has already been accepted" });
      }
      
      // Check if username is already taken
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser && existingUser.id !== user.id) {
        return res.status(400).json({ error: "Username already taken" });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(password);
      
      // Accept the invitation
      const updatedUser = await storage.acceptInvitation(token, {
        username,
        password: hashedPassword
      });
      
      // Log activity
      await storage.logActivity({
        userId: updatedUser.id,
        type: 'invitation_accepted',
        metadata: { username: updatedUser.username }
      });
      
      // Automatically log the user in
      req.login(updatedUser, (err) => {
        if (err) {
          return res.status(500).json({ error: "Authentication error" });
        }
        
        return res.status(200).json({
          success: true,
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            role: updatedUser.role
          },
          message: "Invitation accepted successfully"
        });
      });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return res.status(500).json({ 
        error: error.message || "Server error while accepting invitation" 
      });
    }
  });
  
  // Get invitation details (public route)
  app.get("/api/invites/:token", async (req, res) => {
    try {
      const token = req.params.token;
      if (!token) {
        return res.status(400).json({ error: "Invitation token is required" });
      }
      
      // Find the invitation
      const user = await storage.getUserByInviteToken(token);
      if (!user) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }
      
      // Check if the invitation has already been accepted
      if (user.inviteAcceptedAt) {
        return res.status(400).json({ error: "This invitation has already been accepted" });
      }
      
      // Return the invitation details (only non-sensitive information)
      return res.status(200).json({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        inviteSentAt: user.inviteSentAt,
        userType: user.userType || 'external',
        role: user.role || 'user'
      });
    } catch (error) {
      console.error('Error retrieving invitation:', error);
      return res.status(500).json({ 
        error: "Server error while retrieving invitation details" 
      });
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