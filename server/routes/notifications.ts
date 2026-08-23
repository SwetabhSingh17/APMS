import { Router, Request, Response } from "express";
import { DBStorage } from "../db-storage";
import { isAuthenticatedRequest } from "./utils";

/**
 * Persistent notification inbox endpoints.
 *
 * These back the header bell dropdown and the /notifications page. The
 * WebSocket layer pushes live events and invalidates the
 * ["/api/notifications"] query key, which hits GET /api/notifications here.
 */
export function registerNotificationRoutes(router: Router, storage: DBStorage) {
    // List the current user's notifications (newest first)
    router.get("/api/notifications", async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const notifications = await storage.getUserNotifications(req.user.id);
            res.json(notifications);
        } catch (error) {
            console.error("Error fetching notifications:", error);
            res.status(500).json({ message: "Failed to fetch notifications" });
        }
    });

    // Mark a single notification as read (ownership enforced)
    router.patch("/api/notifications/:id/read", async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ message: "Invalid notification id" });
            }

            const updated = await storage.markNotificationAsReadForUser(id, req.user.id);
            if (!updated) {
                return res.status(404).json({ message: "Notification not found" });
            }
            res.json(updated);
        } catch (error) {
            console.error("Error marking notification as read:", error);
            res.status(500).json({ message: "Failed to mark notification as read" });
        }
    });

    // Mark all of the current user's notifications as read
    router.post("/api/notifications/read-all", async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            await storage.markAllNotificationsAsRead(req.user.id);
            res.json({ message: "All notifications marked as read" });
        } catch (error) {
            console.error("Error marking all notifications as read:", error);
            res.status(500).json({ message: "Failed to mark notifications as read" });
        }
    });

    // Delete all of the current user's notifications
    router.delete("/api/notifications", async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            await storage.deleteAllNotificationsForUser(req.user.id);
            res.json({ message: "Notifications cleared" });
        } catch (error) {
            console.error("Error clearing notifications:", error);
            res.status(500).json({ message: "Failed to clear notifications" });
        }
    });
}
