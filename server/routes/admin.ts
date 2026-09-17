import { Router, Request, Response } from "express";
import { DBStorage } from "../db-storage";
import { UserRole, IOnboardingProgress } from "@shared/schema";
import { requireRole, comparePasswords, hashPassword } from "../auth";
import { isAuthenticatedRequest } from "./utils";
import multer from "multer";
import { generateDemoFormatExcel, parseStudentOnboardingExcel } from "../services/onboarding-parser";
import { generateSupervisorDemoFormatExcel, parseSupervisorOnboardingFile } from "../services/supervisor-onboarding-parser";
import { generateTopicDemoFormatExcel, parseTopicOnboardingFile } from "../services/topic-onboarding-parser";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit for large workbooks
});

export function registerAdminRoutes(router: Router, storage: DBStorage) {
    // User Management: returns all users when no pagination params are sent (or limit=all),
    // and returns paginated results when page/limit are provided.
    router.get("/api/users", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req: Request, res: Response) => {
        try {
            const course = req.query.course as string | undefined;
            const pageParam = req.query.page as string | undefined;
            const limitParam = req.query.limit as string | undefined;

            if (pageParam || (limitParam && limitParam !== "all")) {
                const page = parseInt(pageParam || "1") || 1;
                const limit = parseInt(limitParam || "50") || 50;
                const paginatedUsers = await storage.getPaginatedUsers(page, limit, course);
                const data = paginatedUsers.data.map(({ password, ...user }) => user);
                return res.json({ ...paginatedUsers, data });
            }

            // If no pagination requested or limit=all, return all users for this course (or all courses)
            const users = await storage.getAllUsers(course);
            const data = users.map(({ password, ...user }) => user);
            return res.json({
                data,
                total: data.length,
                page: 1,
                limit: data.length,
                totalPages: 1
            });
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

        // The UI requires typing the admin password — actually enforce it here,
        // so a hijacked session cannot wipe the database without credentials.
        const { password } = req.body as { password?: string };
        if (!password) {
            return res.status(400).json({ message: "Password confirmation is required" });
        }
        try {
            const admin = await storage.getUser(req.user.id);
            if (!admin || !(await comparePasswords(password, admin.password))) {
                return res.status(401).json({ message: "Incorrect admin password" });
            }
        } catch (error) {
            console.error("Reset verification failed:", error);
            return res.status(500).json({ message: "Failed to verify admin password" });
        }

        try {
            const success = await storage.resetDatabase();

            if (success) {
                // Log out and fully destroy the session (its row was truncated),
                // clearing the cookie so no stale connect.sid lingers.
                req.logout((err) => {
                    if (err) console.error("Logout after reset failed:", err);
                    req.session.destroy(() => {
                        res.clearCookie("connect.sid");
                        res.json({ message: "Database reset successfully. Please log in with default credentials." });
                    });
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

            // Validate course if role is being updated to student or if user is a student
            if (updateData.role === "student") {
                if (updateData.course && !["BCA", "MCA"].includes(updateData.course)) {
                    return res.status(400).json({ message: "Course must be either BCA or MCA" });
                }
            } else if (updateData.role && updateData.role !== "student") {
                // Clear course if role is changed to non-student
                updateData.course = null;
            }

            // If password is being updated, hash it first
            if (updateData.password) {
                updateData.password = await hashPassword(updateData.password);
            }

            const user = await storage.updateUser(userId, updateData);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            // Notify Admins if a Coordinator made this change
            if (req.user && (req.user as any).role === "coordinator") {
                const admins = await storage.getUsersByRole("admin" as any);
                for (const admin of admins) {
                    await storage.createNotification({
                        userId: admin.id,
                        title: "Account Updated",
                        message: `Coordinator ${(req.user as any).firstName} updated the account for ${user.firstName} ${user.lastName}.`
                    });
                }
            }

            const { password, ...userWithoutPassword } = user;
            res.status(200).json(userWithoutPassword);
        } catch (error) {
            next(error);
        }
    });

    // Download demo Excel format generated via ExcelJS
    // Enables coordinators and administrators to acquire the official onboarding template
    router.get("/api/admin/onboarding/demo-template", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req: Request, res: Response) => {
        try {
            const buffer = await generateDemoFormatExcel();
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", "attachment; filename=APMS_Student_Onboarding_Demo_Format.xlsx");
            res.send(buffer);
        } catch (error: any) {
            console.error("Error generating demo template:", error);
            res.status(500).json({ message: "Failed to generate Excel demo template" });
        }
    });

    // Bulk onboarding of students and teams with mandatory BCA/MCA data isolation
    // Parses multiple sheets, provisions accounts with forced password reset, and binds teams
    // Supports SSE / streaming progress updates via ?stream=true or Accept: text/event-stream
    router.post(
        "/api/admin/onboarding/upload",
        requireRole([UserRole.ADMIN, UserRole.COORDINATOR]),
        upload.single("file"),
        async (req: Request, res: Response) => {
            if (!isAuthenticatedRequest(req)) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            const isStreaming = req.query.stream === "true" || req.headers.accept === "text/event-stream";

            if (isStreaming) {
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache, no-transform");
                res.setHeader("Connection", "keep-alive");
                res.setHeader("X-Accel-Buffering", "no");
                res.flushHeaders?.();
            }

            const sendProgress = (p: IOnboardingProgress) => {
                if (isStreaming) {
                    res.write(`data: ${JSON.stringify(p)}\n\n`);
                }
            };

            try {
                if (!req.file) {
                    const errMsg = "Please select an Excel file (.xlsx) to continue";
                    if (isStreaming) {
                        sendProgress({ stage: "error", percent: 100, message: errMsg });
                        return res.end();
                    }
                    return res.status(400).json({ message: errMsg });
                }

                const targetCourse = req.body.course as "BCA" | "MCA";
                if (!targetCourse || !["BCA", "MCA"].includes(targetCourse)) {
                    const errMsg = "Target academic program (BCA or MCA) is required for strict data isolation";
                    if (isStreaming) {
                        sendProgress({ stage: "error", percent: 100, message: errMsg });
                        return res.end();
                    }
                    return res.status(400).json({ message: errMsg });
                }

                sendProgress({
                    stage: "parsing",
                    percent: 10,
                    message: "Analyzing worksheets and workbook structure...",
                });

                // Multi-sheet parsing using the ExcelJS-based service
                const parsedData = await parseStudentOnboardingExcel(req.file.buffer);

                if (parsedData.students.length === 0) {
                    const errMsg = "No valid student records with enrollment numbers found in any sheet";
                    if (isStreaming) {
                        sendProgress({ stage: "error", percent: 100, message: errMsg });
                        return res.end();
                    }
                    return res.status(400).json({ message: errMsg });
                }

                sendProgress({
                    stage: "parsing",
                    percent: 20,
                    message: `Discovered ${parsedData.sheetNames.length} sheet(s) with ${parsedData.students.length} student records`,
                    current: 0,
                    total: parsedData.students.length,
                    detail: `Sheets: ${parsedData.sheetNames.join(", ")}`,
                });

                // Automated provisioning in database with course and team isolation
                const result = await storage.bulkOnboardStudentsAndTeams(
                    parsedData.students,
                    targetCourse,
                    req.user.id,
                    (p) => {
                        sendProgress(p);
                    }
                );

                if (isStreaming) {
                    sendProgress({
                        stage: "completed",
                        percent: 100,
                        message: result.message,
                        result
                    });
                    return res.end();
                } else {
                    return res.status(200).json(result);
                }
            } catch (error: any) {
                console.error("Error during bulk onboarding:", error);
                const errMsg = `Failed to process Excel file: ${error.message || "Internal server error"}`;
                if (isStreaming) {
                    sendProgress({ stage: "error", percent: 100, message: errMsg });
                    return res.end();
                } else {
                    res.status(500).json({ message: errMsg });
                }
            }
        }
    );

    // Download demo Excel format for supervisors matching "Updated Staff List with all details.xls"
    router.get(
        "/api/admin/onboarding/supervisor/demo-template",
        requireRole([UserRole.ADMIN, UserRole.COORDINATOR]),
        async (req: Request, res: Response) => {
            try {
                const buffer = await generateSupervisorDemoFormatExcel();
                res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                res.setHeader("Content-Disposition", "attachment; filename=APMS_Supervisor_Staff_List_Demo_Format.xlsx");
                res.send(buffer);
            } catch (error: any) {
                console.error("Error generating supervisor demo template:", error);
                res.status(500).json({ message: "Failed to generate supervisor Excel demo template" });
            }
        }
    );

    // Bulk onboarding of supervisors exclusively
    // Parses .xls or .xlsx, provisions supervisor accounts with empId as username/initial password
    // Enforces forcePasswordReset: true and extracts designation, prefix, mobile, department
    router.post(
        "/api/admin/onboarding/supervisor/upload",
        requireRole([UserRole.ADMIN, UserRole.COORDINATOR]),
        upload.single("file"),
        async (req: Request, res: Response) => {
            if (!isAuthenticatedRequest(req)) {
                return res.status(401).json({ message: "Unauthorized" });
            }

            const isStreaming = req.query.stream === "true" || req.headers.accept === "text/event-stream";

            if (isStreaming) {
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache, no-transform");
                res.setHeader("Connection", "keep-alive");
                res.setHeader("X-Accel-Buffering", "no");
                res.flushHeaders?.();
            }

            const sendProgress = (p: any) => {
                if (isStreaming) {
                    res.write(`data: ${JSON.stringify(p)}\n\n`);
                }
            };

            try {
                if (!req.file) {
                    const errMsg = "Please select a supervisor Excel file (.xls or .xlsx) to continue";
                    if (isStreaming) {
                        sendProgress({ stage: "error", percent: 100, message: errMsg });
                        return res.end();
                    }
                    return res.status(400).json({ message: errMsg });
                }

                sendProgress({
                    stage: "parsing",
                    percent: 25,
                    message: "Parsing supervisor directory sheet...",
                });

                const parsed = await parseSupervisorOnboardingFile(req.file.buffer);

                sendProgress({
                    stage: "provisioning",
                    percent: 50,
                    message: `Extracted ${parsed.supervisors.length} supervisor records from ${parsed.department}. Provisioning accounts...`,
                    current: 0,
                    total: parsed.supervisors.length,
                });

                const result = await storage.bulkOnboardSupervisors(parsed.supervisors);

                if (isStreaming) {
                    sendProgress({
                        stage: "completed",
                        percent: 100,
                        message: result.message,
                        result,
                    });
                    return res.end();
                } else {
                    return res.status(200).json(result);
                }
            } catch (error: any) {
                console.error("Error during supervisor bulk onboarding:", error);
                const errMsg = `Failed to process supervisor file: ${error.message || "Internal server error"}`;
                if (isStreaming) {
                    sendProgress({ stage: "error", percent: 100, message: errMsg });
                    return res.end();
                } else {
                    res.status(500).json({ message: errMsg });
                }
            }
        }
    );

    // =========================================================================
    // BULK PROJECT TOPIC ONBOARDING & VALIDATION
    // =========================================================================

    // Generate downloadable topic suggestions demo Excel template
    router.get(
        "/api/admin/onboarding/topics/demo-template",
        requireRole([UserRole.ADMIN, UserRole.COORDINATOR]),
        async (req: Request, res: Response) => {
            try {
                const buffer = await generateTopicDemoFormatExcel();
                res.setHeader(
                    "Content-Type",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                );
                res.setHeader(
                    "Content-Disposition",
                    "attachment; filename=APMS_Project_Topics_Suggestions_Demo_Format.xlsx"
                );
                return res.send(buffer);
            } catch (error: any) {
                console.error("Error generating topic demo template:", error);
                res.status(500).json({ message: "Failed to generate topic demo template" });
            }
        }
    );

    // Upload, parse, cross-check and assign sequential PUGID26xxx IDs to project topics
    router.post(
        "/api/admin/onboarding/topics/upload",
        requireRole([UserRole.ADMIN, UserRole.COORDINATOR]),
        upload.single("file"),
        async (req: Request, res: Response) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ message: "No Excel file was uploaded." });
                }

                const course = (req.body.course as string || "BCA").trim().toUpperCase();
                const autoApprove = req.body.autoApprove !== "false";

                // 1. Parse Excel file containing faculty submissions
                const parsed = parseTopicOnboardingFile(req.file.buffer);
                if (!parsed.success || parsed.rows.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: parsed.message || "Failed to extract valid topic rows from uploaded workbook.",
                        totalRows: 0,
                        matchedSupervisors: 0,
                        unmatchedSupervisors: 0,
                        totalTopicsCreated: 0,
                        successRecords: [],
                        failureRecords: [],
                    });
                }

                // 2. Cross-check supervisors and insert with sequential PUGID26xxx IDs
                const result = await storage.bulkUploadProjectTopics(course, parsed.rows, {
                    autoApprove,
                });

                return res.status(200).json(result);
            } catch (error: any) {
                console.error("Error during project topic bulk upload:", error);
                return res.status(500).json({
                    success: false,
                    message: `Internal server error during topic bulk upload: ${error.message || error}`,
                });
            }
        }
    );
}

