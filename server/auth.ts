import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { IStorage } from "./storage/interface";
import { User as SelectUser, UserRole } from "@shared/schema";

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

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
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

export function setupAuth(app: Express, storage: IStorage) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "integral-university-project-portal-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
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

  app.post("/api/register", async (req, res, next) => {
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

  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid username or password" });

      req.login(user, (err) => {
        if (err) return next(err);
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
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

  // Admin-only routes
  app.post("/api/admin/users", requireRole([UserRole.ADMIN]), async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if trying to create Admin or Coordinator
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

      // Validate enrollment number for students
      if (req.body.role === UserRole.STUDENT && !req.body.enrollmentNumber) {
        return res.status(400).json({
          message: "Enrollment number is required for student registration"
        });
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      const { password, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/users/:id", requireRole([UserRole.ADMIN]), async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.updateUser(userId, req.body);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/users/:id", requireRole([UserRole.ADMIN]), async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Update own profile
  app.patch("/api/user/profile", async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const allowedFields = ['firstName', 'lastName', 'email'];
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

      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(req.user.id, { password: hashedPassword });

      res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      next(error);
    }
  });


}
