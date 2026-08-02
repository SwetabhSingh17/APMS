import { Router, Request, Response } from "express";
import passport from "passport";
import { DBStorage } from "../db-storage";
import { isAuthenticatedRequest } from "./utils";
import { hashPassword } from "../auth";

export function registerAuthRoutes(router: Router, storage: DBStorage) {
    // Authentication routes
    router.post("/auth/login", passport.authenticate("local"), (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Authentication failed" });
        }
        res.json({ message: "Login successful", user: req.user });
    });

    router.post("/auth/logout", (req: Request, res: Response) => {
        req.logout((err: any) => {
            // ignore err
            res.json({ message: "Logout successful" });
        });
    });

    router.post("/auth/register", async (req: Request, res: Response) => {
        try {
            const { username, password, role, enrollmentNumber, firstName, lastName, email, department } = req.body;

            if (!username || !password || !role || !enrollmentNumber || !firstName || !lastName || !email || !department) {
                return res.status(400).json({ message: "Missing required fields" });
            }

            const hashedPassword = await hashPassword(password);
            const user = await storage.createUser({
                username,
                password: hashedPassword,
                role,
                enrollmentNumber,
                firstName,
                lastName,
                email
            } as any);

            res.status(201).json({ message: "Registration successful", user });
        } catch (error) {
            if (error instanceof Error && error.message.includes("duplicate key")) {
                return res.status(400).json({ message: "Username or enrollment number already exists" });
            }
            res.status(500).json({ message: "Registration failed" });
        }
    });
}
