import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { rateLimit } from "express-rate-limit";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { DBStorage } from "./db-storage";
import { User as SelectUser, UserRole } from "@shared/schema";

/**
 * Rate limiter for authentication endpoints (login, register).
 * Limits each IP to 1000 requests per 15-minute window.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: { message: "Too many attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  if (!supplied || !stored) return false;

  try {
    if (stored.includes(".")) {
      const [hashed, salt] = stored.split(".");
      if (hashed && salt) {
        const hashedBuf = Buffer.from(hashed, "hex");
        const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
        if (hashedBuf.length === suppliedBuf.length && timingSafeEqual(hashedBuf, suppliedBuf)) {
          return true;
        }
      }
    }
  } catch (err) {
    console.error("Error evaluating hashed password:", err);
  }

  // Fallback for legacy or unhashed plaintext passwords in database
  try {
    if (stored === supplied) {
      return true;
    }
  } catch (err) {
    console.error("Error evaluating plaintext password match:", err);
  }

  return false;
}

// Role-based authorization middleware
export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(req.user!.role as UserRole)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }

    next();
  };
};

export function setupAuth(app: Express, storage: DBStorage) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "integral-university-project-portal-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    rolling: true, // Extend session on every request (inactivity timeout)
    cookie: {
      maxAge: 15 * 60 * 1000, // 15 minutes inactivity limit
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Security interceptor: users with forced password reset can only access profile or change password
  // Blocks access to all other operational APIs until mandatory password reset is completed
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && req.user?.forcePasswordReset) {
      const allowedPaths = [
        "/api/user",
        "/api/user/profile",
        "/api/user/change-password",
        "/api/logout",
      ];
      if (req.path.startsWith("/api") && !allowedPaths.includes(req.path)) {
        return res.status(403).json({
          message: "You must update your password on your first login before accessing the system.",
          code: "PASSWORD_RESET_REQUIRED",
          forcePasswordReset: true,
        });
      }
    }
    next();
  });


  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password", code: "USER_NOT_FOUND" } as any);
        }
        if (user.isDeleted) {
          return done(null, false, { message: "This account has been deactivated. Please contact an administrator.", code: "ACCOUNT_DEACTIVATED" } as any);
        }
        const isMatch = await comparePasswords(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid username or password", code: "INVALID_PASSWORD" } as any);
        }

        // Automatic security upgrade: If user password was unhashed / plaintext, transparently rehash it
        if (!user.password.includes(".")) {
          try {
            const upgradedHash = await hashPassword(password);
            await storage.updateUser(user.id, { password: upgradedHash });
          } catch (upgradeErr) {
            console.error("Failed to automatically upgrade unhashed password:", upgradeErr);
          }
        }

        return done(null, user);
      } catch (error: any) {
        console.error("Authentication internal error:", error);
        return done(error, false, { message: "Internal server error during authentication", code: "AUTH_INTERNAL_ERROR" } as any);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", authLimiter, async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if trying to register as Admin or Coordinator
      if (req.body.role === UserRole.ADMIN || req.body.role === UserRole.COORDINATOR) {
        // Check if an admin or coordinator already exists
        const users = await storage.getAllUsers();
        const existingAdmin = users.find(u => u.role === UserRole.ADMIN);
        const existingCoordinator = users.find(u => u.role === UserRole.COORDINATOR);

        if (req.body.role === UserRole.ADMIN && existingAdmin) {
          return res.status(403).json({
            message: "An Admin account already exists. Only one Admin account is allowed in the system."
          });
        }

        if (req.body.role === UserRole.COORDINATOR && existingCoordinator) {
          return res.status(403).json({
            message: "A Coordinator account already exists. Only one Coordinator account is allowed in the system."
          });
        }
      }

      // Add enrollment number validation for students
      if (req.body.role === UserRole.STUDENT) {
        if (!req.body.enrollmentNumber) {
          return res.status(400).json({
            message: "Enrollment number is required for student registration"
          });
        }

        // Check for duplicate enrollment number
        const existingEnrollment = await storage.getUserByEnrollmentNumber(req.body.enrollmentNumber);
        if (existingEnrollment) {
          return res.status(400).json({
            message: "This enrollment number is already registered"
          });
        }
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", authLimiter, (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) {
        console.error("Login authentication error:", err);
        return res.status(500).json({
          message: err.message || "An internal error occurred during authentication",
          code: info?.code || "AUTH_SERVER_ERROR",
        });
      }
      if (!user) {
        return res.status(401).json({
          message: info?.message || "Invalid username or password",
          code: info?.code || "INVALID_CREDENTIALS",
        });
      }

      req.login(user, (err) => {
        if (err) {
          console.error("Login session establishment error:", err);
          return res.status(500).json({
            message: "Failed to establish user session",
            code: "SESSION_CREATION_FAILED",
          });
        }
        const { password, ...userWithoutPassword } = user;
        res.status(200).json({
          ...userWithoutPassword,
          code: "LOGIN_SUCCESS",
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });



  // Update own profile
  app.patch("/api/user/profile", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userRole = (req.user as any)?.role;
      const isAdminOrCoordinator = userRole === UserRole.ADMIN || userRole === UserRole.COORDINATOR;

      // RBAC check: Only ADMIN and COORDINATOR can modify designation
      if (req.body.designation !== undefined && req.body.designation !== (req.user as any)?.designation) {
        if (!isAdminOrCoordinator) {
          return res.status(403).json({
            message: "Access denied. Only administrators and coordinators can update designation.",
            field: "designation",
          });
        }
      }

      const allowedFields = ['firstName', 'lastName', 'email', 'prefix', 'mobile'];
      if (isAdminOrCoordinator) {
        allowedFields.push('designation');
      }

      const updateData = Object.entries(req.body).reduce((acc, [key, value]) => {
        if (allowedFields.includes(key)) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      const user = await storage.updateUser(req.user.id, updateData);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  // Change password
  app.post("/api/user/change-password", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { currentPassword, newPassword } = req.body;
      const user = await storage.getUser(req.user.id);

      if (!user || !(await comparePasswords(currentPassword, user.password))) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      // Generate secure hash for the new password and clear the forced reset flag
      const hashedPassword = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(req.user.id, {
        password: hashedPassword,
        forcePasswordReset: false,
      });

      if (req.user) {
        (req.user as any).forcePasswordReset = false;
      }

      const { password, ...userWithoutPassword } = updatedUser || user;
      res.status(200).json({
        message: "Password updated successfully",
        user: { ...userWithoutPassword, forcePasswordReset: false },
      });
    } catch (error) {
      next(error);
    }
  });


}
