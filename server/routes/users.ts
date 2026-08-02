import { Router, Request, Response } from "express";
import { DBStorage } from "../db-storage";
import { UserRole } from "@shared/schema";
import { isAuthenticatedRequest } from "./utils";

export function registerUserRoutes(router: Router, storage: DBStorage) {
    // Get user profile
    router.get("/api/profile", async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const profile = await storage.getUserProfile(req.user.id);
            res.json(profile);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch profile" });
        }
    });

    // Update user profile
    router.put("/api/profile", async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const { firstName, lastName, email } = req.body;
            const updatedProfile = await storage.updateUserProfile(req.user.id, {
                firstName,
                lastName,
                email
            } as any);
            res.json(updatedProfile);
        } catch (error) {
            res.status(500).json({ message: "Failed to update profile" });
        }
    });

    // Notification Preferences
    router.patch("/api/user/notifications", async (req: Request, res: Response) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            // In a real application, we would store these preferences
            // For now, just return success
            res.json({ message: "Notification preferences updated" });
        } catch (error) {
            res.status(500).json({ message: "Failed to update notification preferences" });
        }
    });

    // Get all teachers
    router.get("/api/teachers", async (req: Request, res: Response) => {
        try {
            const teachers = await storage.getUsersByRole(UserRole.TEACHER);
            res.json(teachers);
        } catch (error) {
            console.error("Error fetching teachers:", error);
            res.status(500).json({ message: "Failed to fetch teachers" });
        }
    });
}
