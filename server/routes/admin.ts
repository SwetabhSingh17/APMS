import { Router, Request, Response } from "express";
import { IStorage } from "../storage/interface";
import { UserRole } from "@shared/schema";
import { requireRole } from "../auth";
import { isAuthenticatedRequest } from "./utils";
import { hashPassword } from "../auth";

export function registerAdminRoutes(router: Router, storage: IStorage) {
    // User Management
    router.get("/api/users", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req: Request, res: Response) => {
        try {
            const users = await storage.getAllUsers();
            // Remove passwords from response
            const usersWithoutPasswords = users.map(({ password, ...user }) => user);
            res.json(usersWithoutPasswords);
        } catch (error) {
            res.status(500).json({ message: "Failed to fetch users" });
        }
    });

    // Export Database Data
    router.post("/api/admin/export", requireRole([UserRole.ADMIN]), async (req: Request, res: Response) => {
        try {
            const data = await storage.exportData();

            // Set headers for file download
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=database-export.json');

            res.json(data);
        } catch (error) {
            console.error("Export failed:", error);
            res.status(500).json({ message: "Failed to export data" });
        }
    });

    // Reset Database
    router.post("/api/admin/reset", requireRole([UserRole.ADMIN]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const success = await storage.resetDatabase();

            if (success) {
                // Log out the user since their account (or session) might be affected/reset
                req.logout((err) => {
                    // ignore err
                    res.json({ message: "Database reset successfully. Please log in with default credentials." });
                });
            } else {
                res.status(500).json({ message: "Failed to reset database" });
            }
        } catch (error) {
            console.error("Reset failed:", error);
            res.status(500).json({ message: "An error occurred while resetting database" });
        }
    });

    // Import/Restore Database
    router.post("/api/admin/import", requireRole([UserRole.ADMIN]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const importData = req.body;

            // Validate that we have data
            if (!importData || typeof importData !== 'object') {
                return res.status(400).json({ message: "Invalid import data" });
            }

            // Validate required structure
            if (!importData.users && !importData.projectTopics && !importData.studentProjects) {
                return res.status(400).json({
                    message: "Invalid import format: missing required data tables"
                });
            }

            await storage.importData(importData);
            res.json({ message: "Database restored successfully" });
        } catch (error) {
            console.error("Import failed:", error);
            res.status(500).json({ message: "Failed to import database" });
        }
    });

    // Generate Excel Report
    router.post("/api/admin/export-excel", requireRole([UserRole.ADMIN]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const reportData = await storage.generateExcelReport();
            res.json({ data: reportData });
        } catch (error) {
            console.error("Excel export failed:", error);
            res.status(500).json({ message: "Failed to generate Excel report" });
        }
    });

    /*
     * NOTE: The following route was present in the original routes.ts but might be shadowed by auth.ts routes.
     * It provides password hashing and allows Coordinators to update users.
     * Since auth.ts registers a similar route matching /api/admin/users/:id first, this one might be unreachable
     * unless the auth.ts one is removed or modified.
     * We verify if we should keep it.
     */
    router.patch("/api/admin/users/:id", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req: Request, res: Response, next: any) => {
        try {
            const userId = parseInt(req.params.id);
            const updateData = { ...req.body };

            // If password is being updated, hash it first
            if (updateData.password) {
                updateData.password = await hashPassword(updateData.password);
            }

            const user = await storage.updateUser(userId, updateData);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const { password, ...userWithoutPassword } = user;
            res.status(200).json(userWithoutPassword);
        } catch (error) {
            next(error);
        }
    });
}
