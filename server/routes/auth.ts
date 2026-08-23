import { Router, Request, Response } from "express";
import passport from "passport";
import { DBStorage } from "../db-storage";
import { isAuthenticatedRequest } from "./utils";

export function registerAuthRoutes(router: Router, storage: DBStorage) {
    // Authentication routes
    //
    // SECURITY NOTE: This legacy `/auth/*` surface is kept ONLY for backwards
    // compatibility with dev/test scripts (`scripts/e2e_verify.ts`,
    // `scripts/seed_test_data.ts`). The client exclusively uses `/api/login`.
    //
    // - `/auth/register` was REMOVED: it accepted arbitrary roles (including
    //   admin) from anonymous callers — a privilege-escalation hole. All
    //   registration must go through `/api/register`, which enforces the
    //   single-Admin/single-Coordinator rule and enrollment validation.
    // - `/auth/login` strips the password hash before responding.
    router.post("/auth/login", passport.authenticate("local"), (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Authentication failed" });
        }
        const { password, ...userWithoutPassword } = req.user;
        res.json({ message: "Login successful", user: userWithoutPassword });
    });

    router.post("/auth/logout", (req: Request, res: Response) => {
        req.logout((err: any) => {
            // ignore err
            res.json({ message: "Logout successful" });
        });
    });
}
