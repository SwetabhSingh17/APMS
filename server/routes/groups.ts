import { Router, Request, Response } from "express";
import { DBStorage } from "../db-storage";
import { UserRole } from "@shared/schema";
import { requireRole } from "../auth";
import { isAuthenticatedRequest } from "./utils";

export function registerGroupRoutes(router: Router, storage: DBStorage) {
    // Create a new student group
    router.post("/api/student-groups", requireRole([UserRole.STUDENT, UserRole.ADMIN, UserRole.COORDINATOR]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const { name, description, supervisorId, enrollmentNumbers } = req.body;
            const isStudent = req.user.role === UserRole.STUDENT;

            // Validate that the student is not already in a group
            if (isStudent) {
                const existingGroup = await storage.getUserGroup(req.user.id);
                if (existingGroup) {
                    return res.status(400).json({ message: "You are already in a team" });
                }
            }

            // Validate supervisor exists
            const supervisor = await storage.getUser(supervisorId);
            if (!supervisor || supervisor.role !== UserRole.SUPERVISOR) {
                return res.status(400).json({ message: "Invalid supervisor mentor" });
            }

            // If created by a student, they are part of the team
            const totalSize = enrollmentNumbers.length + (isStudent ? 1 : 0);

            let teamCourse = (req.user as any).course;

            const students = await Promise.all(
                enrollmentNumbers.map(async (enrollmentNumber: string) => {
                    const student = await storage.getUserByEnrollmentNumber(enrollmentNumber);
                    if (!student || student.role !== UserRole.STUDENT) {
                        throw new Error(`Invalid student enrollment number: ${enrollmentNumber}`);
                    }
                    return student;
                })
            );

            // If Admin/Coordinator creates, determine course from first student
            if (!isStudent && students.length > 0) {
                teamCourse = students[0].course;
            } else if (!isStudent && students.length === 0) {
                throw new Error("Admin/Coordinator must add at least one student to create a team.");
            }

            // Validate all students are in the same course
            for (const student of students) {
                if (teamCourse && student.course && student.course !== teamCourse) {
                    throw new Error(`Student ${student.firstName} ${student.lastName} is in a different course (${student.course}) and cannot be added to a ${teamCourse} team.`);
                }
            }

            // Check size constraints
            if (teamCourse === "BCA") {
                if (isStudent && (totalSize < 2 || totalSize > 5)) {
                    throw new Error("BCA student teams must have between 2 and 5 members.");
                } else if (!isStudent && (totalSize < 1 || totalSize > 5)) {
                    throw new Error("BCA student teams must have between 1 and 5 members.");
                }
            } else if (teamCourse === "MCA") {
                if (totalSize < 1 || totalSize > 2) {
                    throw new Error("MCA student teams must have 1 or 2 members.");
                }
            }

            // Check if any student is already in a group
            for (const student of students) {
                const studentGroup = await storage.getUserGroup(student.id);
                if (studentGroup) {
                    return res.status(400).json({
                        message: `Student ${student.firstName} ${student.lastName} is already in a team`
                    });
                }
            }

            const maxSize = teamCourse === "BCA" ? 5 : 2;

            // Create the group with invites
            const group = await storage.createStudentGroup({
                name,
                description,
                supervisorId,
                maxSize,
                course: teamCourse
            } as any, req.user.id, enrollmentNumbers, !isStudent);

            res.status(201).json(group);
        } catch (error) {
            if (error instanceof Error) {
                res.status(400).json({ message: error.message });
            } else {
                res.status(500).json({ message: "Internal Server Error" });
            }
        }
    });

    // Update team members directly (Admin, Coordinator, Supervisor)
    router.patch("/api/student-groups/:groupId/members", requireRole([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.SUPERVISOR]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const groupId = parseInt(req.params.groupId);
            const { enrollmentNumbers } = req.body;

            const group = await storage.getGroup(groupId);
            if (!group) return res.status(404).json({ message: "Team not found" });

            // If Supervisor, verify they are supervising this team
            if (req.user.role === UserRole.SUPERVISOR && group.supervisorId !== req.user.id) {
                return res.status(403).json({ message: "You can only edit members of your own teams." });
            }

            // Validate all enrollment numbers are students of the same course
            const teamCourse = group.course;
            for (const en of enrollmentNumbers) {
                const student = await storage.getUserByEnrollmentNumber(en);
                if (!student || student.role !== UserRole.STUDENT) {
                    throw new Error(`Invalid student enrollment number: ${en}`);
                }
                if (teamCourse && student.course && student.course !== teamCourse) {
                    throw new Error(`Student ${student.firstName} ${student.lastName} is in a different course (${student.course}) and cannot be added to a ${teamCourse} team.`);
                }
                
                const studentGroup = await storage.getUserGroup(student.id);
                if (studentGroup && studentGroup.id !== groupId) {
                    throw new Error(`Student ${student.firstName} ${student.lastName} is already in another team.`);
                }
            }

            // Validate size constraints
            const totalSize = enrollmentNumbers.length;
            if (teamCourse === "BCA") {
                if (totalSize < 1 || totalSize > 5) {
                    throw new Error("BCA student teams must have between 1 and 5 members.");
                }
            } else if (teamCourse === "MCA") {
                if (totalSize < 1 || totalSize > 2) {
                    throw new Error("MCA student teams must have 1 or 2 members.");
                }
            }

            await storage.updateStudentGroupMembers(groupId, enrollmentNumbers);

            // Send notifications to Admin, Coordinator, and the Supervisor
            const admins = await storage.getUsersByRole(UserRole.ADMIN);
            const coordinators = await storage.getUsersByRole(UserRole.COORDINATOR);
            
            const notifyUsers = [...admins, ...coordinators];
            if (group.supervisorId) {
                const supervisorUser = await storage.getUser(group.supervisorId);
                if (supervisorUser) notifyUsers.push(supervisorUser);
            }

            // Deduplicate users in case someone has multiple roles or to avoid duplicate notifications
            const uniqueNotifyUsers = Array.from(new Map(notifyUsers.map(user => [user.id, user])).values());

            for (const user of uniqueNotifyUsers) {
                // Don't notify the person who made the change
                if (user.id === req.user.id) continue;

                await storage.createNotification({
                    userId: user.id,
                    title: "Team Members Updated",
                    message: `The members for Project Team "${group.name}" have been updated by ${req.user.firstName} ${req.user.lastName}.`
                });
            }

            res.json({ message: "Team members updated successfully." });
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

    // Get all student groups (for coordinators and admins)
    router.get("/api/student-groups", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        try {
            let groups = await storage.getAllStudentGroups();
            const courseFilter = req.query.course as string | undefined;

            if (courseFilter) {
                // Filter groups by the creator's course
                // Since `groups` already includes a `members` array, we can check the members.
                // Or we check the first member's course. Since all members must be of the same course now,
                // any member's course will do.
                groups = groups.filter(group => {
                    if (!group.members || group.members.length === 0) return false;
                    return group.members.some((m: any) => m.course === courseFilter);
                });
            }

            res.json(groups);
        } catch (error) {
            console.error("Error fetching all student groups:", error);
            res.status(500).json({ message: "Failed to fetch student groups" });
        }
    });

    // Change supervisor allotment for a group (coordinators and admins only)
    router.patch("/api/student-groups/:groupId/supervisor", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const groupId = parseInt(req.params.groupId);
            const { supervisorId } = req.body;

            if (!supervisorId || typeof supervisorId !== "number") {
                return res.status(400).json({ message: "A valid supervisorId is required" });
            }

            // Validate the group exists
            const group = await storage.getGroup(groupId);
            if (!group) {
                return res.status(404).json({ message: "Group not found" });
            }

            // Validate the target user is a supervisor
            const supervisor = await storage.getUser(supervisorId);
            if (!supervisor || supervisor.role !== UserRole.SUPERVISOR) {
                return res.status(400).json({ message: "The selected user is not a valid supervisor" });
            }

            const previousSupervisorId = group.supervisorId;

            // Update the group
            const updatedGroup = await storage.updateStudentGroupSupervisor(groupId, supervisorId);

            // Notify the newly assigned supervisor
            await storage.createNotification({
                userId: supervisorId,
                title: "Supervisor Assignment",
                message: `You have been assigned as the supervisor for group "${group.name}" by ${req.user.firstName} ${req.user.lastName}.`,
            });

            // Notify the previous supervisor if there was one and it changed
            if (previousSupervisorId && previousSupervisorId !== supervisorId) {
                await storage.createNotification({
                    userId: previousSupervisorId,
                    title: "Supervisor Reassignment",
                    message: `You have been unassigned from group "${group.name}". A new supervisor has been assigned.`,
                });
            }

            res.json(updatedGroup);
        } catch (error) {
            console.error("Error updating supervisor allotment:", error);
            res.status(500).json({ message: "Failed to update supervisor allotment" });
        }
    });
}
