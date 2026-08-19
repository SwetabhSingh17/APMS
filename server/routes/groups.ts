import { Router, Request, Response } from "express";
import { DBStorage } from "../db-storage";
import { UserRole } from "@shared/schema";
import { requireRole } from "../auth";
import { isAuthenticatedRequest } from "./utils";

export function registerGroupRoutes(router: Router, storage: DBStorage) {
    // Create a new student group
    router.post("/api/student-groups", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const { name, description, supervisorId, enrollmentNumbers } = req.body;

            // Validate that the user is not already in a group
            const existingGroup = await storage.getUserGroup(req.user.id);
            if (existingGroup) {
                return res.status(400).json({ message: "You are already in a group" });
            }

            // Validate supervisor exists
            const supervisor = await storage.getUser(supervisorId);
            if (!supervisor || supervisor.role !== UserRole.SUPERVISOR) {
                return res.status(400).json({ message: "Invalid supervisor mentor" });
            }

            // Validate all enrollment numbers exist and are students
            const students = await Promise.all(
                enrollmentNumbers.map(async (enrollmentNumber: string) => {
                    const student = await storage.getUserByEnrollmentNumber(enrollmentNumber);
                    if (!student || student.role !== UserRole.STUDENT) {
                        throw new Error(`Invalid student enrollment number: ${enrollmentNumber}`);
                    }
                    return student;
                })
            );

            // Check if any student is already in a group
            for (const student of students) {
                const studentGroup = await storage.getUserGroup(student.id);
                if (studentGroup) {
                    return res.status(400).json({
                        message: `Student ${student.firstName} ${student.lastName} is already in a group`
                    });
                }
            }

            // Create the group with invites
            const group = await storage.createStudentGroup({
                name,
                description,
                supervisorId,
                maxSize: 5,
            } as any, req.user.id, enrollmentNumbers);

            // Invited members are now handled by createStudentGroup


            res.status(201).json(group);
        } catch (error) {
            if (error instanceof Error) {
                res.status(400).json({ message: error.message });
            } else {
                res.status(500).json({ message: "Internal Server Error" });
            }
        }
    });

    // Accept group invite
    router.post("/api/groups/invite/:groupId/accept", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const groupId = parseInt(req.params.groupId);
        const success = await storage.acceptGroupInvite(req.user.id, groupId);
        if (success) {
            res.sendStatus(200);
        } else {
            res.status(400).json({ message: "Failed to accept invite" });
        }
    });

    // Reject group invite
    router.post("/api/groups/invite/:groupId/reject", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const groupId = parseInt(req.params.groupId);
        const success = await storage.rejectGroupInvite(req.user.id, groupId);
        if (success) {
            res.sendStatus(200);
        } else {
            res.status(400).json({ message: "Failed to reject invite" });
        }
    });

    // Get current user's group
    router.get("/api/student-groups/my-group", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const membership = await storage.getUserGroupMembership(req.user.id);
            if (!membership) {
                return res.status(404).json({ message: "You are not in a group" });
            }

            const { group, status } = membership;

            // Get group members and supervisor details
            const members = await storage.getStudentGroupMembers(group.id);
            const supervisor = group.supervisorId ? await storage.getUser(group.supervisorId) : null;

            // Return the complete group data with members and supervisor
            res.json({
                ...group,
                myStatus: status,
                members: members.map(member => ({
                    id: member.id,
                    firstName: member.firstName,
                    lastName: member.lastName,
                    email: member.email,
                    enrollmentNumber: member.enrollmentNumber,
                    role: member.role
                })),
                supervisor: supervisor ? {
                    id: supervisor.id,
                    firstName: supervisor.firstName,
                    lastName: supervisor.lastName,
                    email: supervisor.email,
                    role: supervisor.role
                } : null
            });
        } catch (error) {
            console.error("Error fetching group:", error);
            res.status(500).json({ message: "Failed to fetch group" });
        }
    });

    // Leave a group
    router.post("/api/student-groups/:groupId/leave", requireRole([UserRole.STUDENT]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const groupId = parseInt(req.params.groupId);
            const group = await storage.getGroup(groupId);

            if (!group) {
                return res.status(404).json({ message: "Group not found" });
            }

            // Check if user is in the group
            const userGroup = await storage.getUserGroup(req.user.id);
            if (!userGroup || userGroup.id !== groupId) {
                return res.status(400).json({ message: "You are not a member of this group" });
            }

            // Remove user from group
            await storage.removeStudentFromGroup(req.user.id, groupId);

            res.json({ message: "Successfully left the group" });
        } catch (error) {
            console.error("Error leaving group:", error);
            res.status(500).json({ message: "Failed to leave group" });
        }
    });
}
