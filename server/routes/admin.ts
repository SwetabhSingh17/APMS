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

    // Create a new user (Admin and Coordinator accessible)
    router.post("/api/admin/users", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req: Request, res: Response, next: any) => {
        try {
            const { confirmPassword, ...userData } = req.body;
            const callerRole = (req.user as any)?.role;

            const existingUser = await storage.getUserByUsername(userData.username);
            if (existingUser) {
                return res.status(400).json({ message: "Username already exists", code: "USERNAME_EXISTS" });
            }

            // RBAC checks for high-privilege roles
            if (userData.role === UserRole.ADMIN) {
                if (callerRole === UserRole.COORDINATOR) {
                    return res.status(403).json({ message: "Coordinators cannot create Administrator accounts", code: "FORBIDDEN" });
                }
                const users = await storage.getAllUsers();
                const existingAdmin = users.find(u => u.role === UserRole.ADMIN);
                if (existingAdmin) {
                    return res.status(403).json({
                        message: "An Admin account already exists. Only one Admin account is allowed in the system.",
                        code: "SINGLE_ADMIN_LIMIT"
                    });
                }
            }

            if (userData.role === UserRole.COORDINATOR) {
                const users = await storage.getAllUsers();
                const existingCoordinator = users.find(u => u.role === UserRole.COORDINATOR);
                if (existingCoordinator) {
                    return res.status(403).json({
                        message: "A Coordinator account already exists. Only one Coordinator account is allowed in the system.",
                        code: "SINGLE_COORDINATOR_LIMIT"
                    });
                }
            }

            // Validate enrollment number and course for students
            if (userData.role === UserRole.STUDENT) {
                if (!userData.enrollmentNumber) {
                    return res.status(400).json({
                        message: "Enrollment number is required for student registration",
                        code: "ENROLLMENT_REQUIRED"
                    });
                }
                const existingEnrollment = await storage.getUserByEnrollmentNumber(userData.enrollmentNumber);
                if (existingEnrollment) {
                    return res.status(400).json({
                        message: "This enrollment number is already registered",
                        code: "ENROLLMENT_EXISTS"
                    });
                }
                if (userData.course && !["BCA", "MCA"].includes(userData.course)) {
                    return res.status(400).json({ message: "Course must be either BCA or MCA", code: "INVALID_COURSE" });
                }
            }

            if (!userData.password || userData.password.length < 6) {
                return res.status(400).json({ message: "Password must be at least 6 characters long", code: "PASSWORD_TOO_SHORT" });
            }

            const hashedPassword = await hashPassword(userData.password);
            const user = await storage.createUser({
                ...userData,
                password: hashedPassword,
                forcePasswordReset: false,
            });

            const { password, ...userWithoutPassword } = user;
            res.status(201).json(userWithoutPassword);
        } catch (error) {
            next(error);
        }
    });

    // Update existing user (password change, profile details, course)
    router.patch("/api/admin/users/:id", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req: Request, res: Response, next: any) => {
        try {
            const userId = parseInt(req.params.id);
            const { confirmPassword, id, ...updateData } = req.body;
            const callerRole = (req.user as any)?.role;

            const existingUser = await storage.getUser(userId);
            if (!existingUser) {
                return res.status(404).json({ message: "User not found", code: "USER_NOT_FOUND" });
            }

            // Security guardrails for Coordinators
            if (callerRole === UserRole.COORDINATOR) {
                if (existingUser.role === UserRole.ADMIN) {
                    return res.status(403).json({
                        message: "Coordinators cannot modify administrator accounts",
                        code: "FORBIDDEN_TARGET_ADMIN"
                    });
                }
                if (updateData.role === UserRole.ADMIN) {
                    return res.status(403).json({
                        message: "Coordinators cannot assign the Administrator role",
                        code: "FORBIDDEN_ROLE_ELEVATION"
                    });
                }
            }

            // Validate course if role is being updated to student or if user is a student
            if (updateData.role === "student" || (existingUser.role === "student" && updateData.course !== undefined)) {
                if (updateData.course && !["BCA", "MCA"].includes(updateData.course)) {
                    return res.status(400).json({ message: "Course must be either BCA or MCA", code: "INVALID_COURSE" });
                }
            } else if (updateData.role && updateData.role !== "student") {
                // Clear course if role is changed to non-student
                updateData.course = null;
            }

            // If password is being updated, validate length, hash it, and ensure forced reset is cleared
            if (updateData.password) {
                if (typeof updateData.password !== "string" || updateData.password.trim().length < 6) {
                    return res.status(400).json({
                        message: "Password must be at least 6 characters long",
                        code: "PASSWORD_TOO_SHORT"
                    });
                }
                updateData.password = await hashPassword(updateData.password.trim());
                // Explicitly clear forced password reset so students can log in directly without prompt
                updateData.forcePasswordReset = false;
            }

            const user = await storage.updateUser(userId, updateData);
            if (!user) {
                return res.status(404).json({ message: "User not found", code: "USER_NOT_FOUND" });
            }

            // Notify Admins if a Coordinator made this change
            if (req.user && callerRole === "coordinator") {
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

    // Delete user (Admin and Coordinator accessible with safeguards)
    router.delete("/api/admin/users/:id", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req: Request, res: Response, next: any) => {
        try {
            const userId = parseInt(req.params.id);
            const callerRole = (req.user as any)?.role;

            const existingUser = await storage.getUser(userId);
            if (!existingUser) {
                return res.status(404).json({ message: "User not found", code: "USER_NOT_FOUND" });
            }

            // Coordinators cannot delete Administrator or Coordinator accounts
            if (callerRole === UserRole.COORDINATOR) {
                if (existingUser.role === UserRole.ADMIN || existingUser.role === UserRole.COORDINATOR) {
                    return res.status(403).json({
                        message: "Coordinators cannot delete administrator or coordinator accounts",
                        code: "FORBIDDEN_DELETE_STAFF"
                    });
                }
            }

            const success = await storage.deleteUser(userId);
            if (!success) {
                return res.status(404).json({ message: "User not found", code: "USER_NOT_FOUND" });
            }

            res.status(200).json({ message: "User deleted successfully", code: "USER_DELETED" });
        } catch (error) {
            next(error);
        }
    });

    // Reset user password to default credential (Enrollment No for Students, EmpID for Supervisors)
    router.post("/api/admin/users/:id/reset-password", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req: Request, res: Response, next: any) => {
        try {
            const userId = parseInt(req.params.id);
            const callerRole = (req.user as any)?.role;

            const targetUser = await storage.getUser(userId);
            if (!targetUser) {
                return res.status(404).json({ message: "User not found", code: "USER_NOT_FOUND" });
            }

            // RBAC checks: Coordinators cannot reset Admin or Coordinator accounts
            if (callerRole === UserRole.COORDINATOR && (targetUser.role === UserRole.ADMIN || targetUser.role === UserRole.COORDINATOR)) {
                return res.status(403).json({
                    message: "Coordinators cannot reset passwords for administrator or coordinator accounts",
                    code: "FORBIDDEN_TARGET_STAFF"
                });
            }

            let defaultPassword = "";
            let defaultType = "";

            if (targetUser.role === UserRole.STUDENT) {
                defaultPassword = targetUser.enrollmentNumber || targetUser.username;
                defaultType = "Enrollment Number";
                if (!defaultPassword) {
                    return res.status(400).json({
                        message: "Cannot reset password: user has no enrollment number configured",
                        code: "NO_DEFAULT_CREDENTIAL"
                    });
                }
            } else if (targetUser.role === UserRole.SUPERVISOR) {
                defaultPassword = targetUser.empId || targetUser.username;
                defaultType = "Employee ID";
                if (!defaultPassword) {
                    return res.status(400).json({
                        message: "Cannot reset password: user has no Employee ID configured",
                        code: "NO_DEFAULT_CREDENTIAL"
                    });
                }
            } else {
                return res.status(400).json({
                    message: "Default password reset is only supported for students (Enrollment Number) and supervisors (Employee ID)",
                    code: "UNSUPPORTED_ROLE"
                });
            }

            // Hash the default password and set forcePasswordReset: true so user is prompted to change it on next login
            const hashedPassword = await hashPassword(defaultPassword.trim());
            const updatedUser = await storage.updateUser(userId, {
                password: hashedPassword,
                forcePasswordReset: true,
            });

            // Notify Admins if a Coordinator performed the reset
            if (req.user && callerRole === UserRole.COORDINATOR) {
                const admins = await storage.getUsersByRole(UserRole.ADMIN);
                for (const admin of admins) {
                    await storage.createNotification({
                        userId: admin.id,
                        title: "Password Reset to Default",
                        message: `Coordinator ${(req.user as any).firstName} reset the password for ${targetUser.firstName} ${targetUser.lastName} (${targetUser.role}) to their default ${defaultType}.`
                    });
                }
            }

            const { password, ...userWithoutPassword } = updatedUser || targetUser;
            res.status(200).json({
                message: `Password successfully reset to default ${defaultType} (${defaultPassword}). The user will be required to set a new password on their next login.`,
                code: "PASSWORD_RESET_DEFAULT_SUCCESS",
                defaultType,
                user: userWithoutPassword,
            });
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

