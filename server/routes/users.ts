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

    // Get all supervisors
    router.get("/api/supervisors", async (req: Request, res: Response) => {
        try {
            const supervisors = await storage.getUsersByRole(UserRole.SUPERVISOR);
            res.json(supervisors);
        } catch (error) {
            console.error("Error fetching supervisors:", error);
            res.status(500).json({ message: "Failed to fetch supervisors" });
        }
    });

    // Get all students
    router.get("/api/students", async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        try {
            const course = req.query.course as string | undefined;
            let students = await storage.getUsersByRole(UserRole.STUDENT);
            
            if (course) {
                students = students.filter(s => s.course === course);
            }

            // Return stripped down data for safety
            const safeStudents = students.map(({ id, firstName, lastName, enrollmentNumber, course, department }) => ({
                id, firstName, lastName, enrollmentNumber, course, department
            }));

            res.json(safeStudents);
        } catch (error) {
            console.error("Error fetching students:", error);
            res.status(500).json({ message: "Failed to fetch students" });
        }
    });
}
