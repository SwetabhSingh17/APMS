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

            // Validate supervisor exists if provided (supervisor is allotted after picking topic)
            let parsedSupervisorId: number | null = null;
            if (supervisorId !== undefined && supervisorId !== null && supervisorId !== "" && supervisorId !== "none" && supervisorId !== "0" && supervisorId !== 0) {
                const sid = typeof supervisorId === "string" ? parseInt(supervisorId) : Number(supervisorId);
                if (!isNaN(sid) && sid > 0) {
                    const supervisor = await storage.getUser(sid);
                    if (!supervisor || supervisor.role !== UserRole.SUPERVISOR) {
                        return res.status(400).json({ message: "Invalid supervisor mentor" });
                    }
                    parsedSupervisorId = sid;
                }
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
                supervisorId: parsedSupervisorId,
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

    // Update team members directly (Admin and Coordinator only)
    router.patch("/api/student-groups/:groupId/members", requireRole([UserRole.ADMIN, UserRole.COORDINATOR]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const groupId = parseInt(req.params.groupId);
            const { enrollmentNumbers } = req.body;

            const group = await storage.getGroup(groupId);
            if (!group) return res.status(404).json({ message: "Team not found" });

            // Validate all enrollment numbers are students of the same course
            let teamCourse: string | null = null;
            for (const en of enrollmentNumbers) {
                const student = await storage.getUserByEnrollmentNumber(en);
                if (!student || student.role !== UserRole.STUDENT) {
                    throw new Error(`Invalid student enrollment number: ${en}`);
                }
                if (!teamCourse) {
                    teamCourse = student.course;
                } else if (student.course && student.course !== teamCourse) {
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
            let supervisor = group.supervisorId ? await storage.getUser(group.supervisorId) : null;

            // Fallback resolution: If group.supervisorId is null, check if any member has an assigned project
            if (!supervisor) {
                for (const member of members) {
                    const memberProjects = await storage.getStudentProjects(member.id);
                    if (memberProjects.length > 0 && memberProjects[0].topicId) {
                        const topic = await storage.getProjectTopic(memberProjects[0].topicId);
                        if (topic && topic.submittedById) {
                            supervisor = await storage.getUser(topic.submittedById);
                            // Self-heal the database record
                            await storage.updateStudentGroupSupervisor(group.id, topic.submittedById);
                            break;
                        }
                    }
                }
            }

            // Return the complete group data with members and supervisor
            res.json({
                ...group,
                supervisorId: supervisor ? supervisor.id : group.supervisorId,
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
                    prefix: supervisor.prefix || "",
                    firstName: supervisor.firstName,
                    lastName: supervisor.lastName,
                    email: supervisor.email,
                    department: supervisor.department,
                    designation: (supervisor as any).designation,
                    role: supervisor.role
                } : null
            });
        } catch (error) {
            console.error("Error fetching group:", error);
            res.status(500).json({ message: "Failed to fetch group" });
        }
    });

    // Leave a group - students and supervisors are not permitted to leave or modify teams
    router.post("/api/student-groups/:groupId/leave", async (req: Request, res: Response) => {
        return res.status(403).json({
            message: "Students and supervisors are not permitted to leave or modify project teams. Only Administrators and Coordinators can modify team memberships."
        });
    });

    // Get all student groups (for coordinators and admins)
    router.get("/api/student-groups", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        try {
            let groups = await storage.getAllStudentGroups();
            const courseFilter = req.query.course as string | undefined;

            if (courseFilter) {
                const normalizedFilter = courseFilter.trim().toUpperCase();
                groups = groups.filter(group => {
                    // 1. Check direct course assigned to the group record
                    if (group.course && group.course.trim().toUpperCase() === normalizedFilter) {
                        return true;
                    }
                    // 2. Check if any member belongs to the filtered course
                    if (group.members && group.members.length > 0) {
                        return group.members.some((m: any) => m.course && m.course.trim().toUpperCase() === normalizedFilter);
                    }
                    return false;
                });
            }

            res.json(groups);
        } catch (error) {
            console.error("Error fetching all student groups:", error);
            res.status(500).json({ message: "Failed to fetch student groups" });
        }
    });

    // Change supervisor allotment for a group (coordinators and admins only)
    // Change supervisor allotment for a group (coordinators and admins only)
    router.patch("/api/student-groups/:groupId/supervisor", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const groupId = parseInt(req.params.groupId);
            const { supervisorId } = req.body;

            // Validate the group exists
            const group = await storage.getGroup(groupId);
            if (!group) {
                return res.status(404).json({ message: "Group not found" });
            }

            // Unassign supervisor if null, 0, or "none"
            if (supervisorId === null || supervisorId === 0 || supervisorId === "none" || supervisorId === "") {
                const previousSupervisorId = group.supervisorId;
                const updatedGroup = await storage.updateStudentGroup(groupId, { supervisorId: null });
                if (previousSupervisorId) {
                    await storage.createNotification({
                        userId: previousSupervisorId,
                        title: "Supervisor Unassigned",
                        message: `You have been unassigned as the supervisor for group "${group.name}".`,
                    });
                }
                return res.json(updatedGroup);
            }

            const targetSupervisorId = typeof supervisorId === "string" ? parseInt(supervisorId) : supervisorId;
            if (!targetSupervisorId || typeof targetSupervisorId !== "number" || isNaN(targetSupervisorId)) {
                return res.status(400).json({ message: "A valid supervisorId is required" });
            }

            // Validate the target user is a supervisor
            const supervisor = await storage.getUser(targetSupervisorId);
            if (!supervisor || supervisor.role !== UserRole.SUPERVISOR) {
                return res.status(400).json({ message: "The selected user is not a valid supervisor" });
            }

            const previousSupervisorId = group.supervisorId;

            // Update the group
            const updatedGroup = await storage.updateStudentGroupSupervisor(groupId, targetSupervisorId);

            // Notify the newly assigned supervisor
            await storage.createNotification({
                userId: targetSupervisorId,
                title: "Supervisor Assignment",
                message: `You have been assigned as the supervisor for group "${group.name}" by ${req.user.firstName} ${req.user.lastName}.`,
            });

            // Notify the previous supervisor if there was one and it changed
            if (previousSupervisorId && previousSupervisorId !== targetSupervisorId) {
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

    // Update team basic details (Admin and Coordinator only)
    router.patch("/api/student-groups/:groupId", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const groupId = parseInt(req.params.groupId);
            const { name, description, course } = req.body;

            const group = await storage.getGroup(groupId);
            if (!group) return res.status(404).json({ message: "Team not found" });

            const updated = await storage.updateStudentGroup(groupId, { name, description, course });
            res.json(updated);
        } catch (error) {
            console.error("Error updating team details:", error);
            res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
        }
    });

    // Delete / dissolve a team entirely while preserving student accounts (Admin and Coordinator only)
    router.delete("/api/student-groups/:groupId", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const groupId = parseInt(req.params.groupId);
            if (isNaN(groupId)) {
                return res.status(400).json({ message: "Invalid team ID" });
            }

            const group = await storage.getGroup(groupId);
            if (!group) {
                return res.status(404).json({ message: "Team not found" });
            }

            const success = await storage.deleteStudentGroup(groupId);
            if (!success) {
                return res.status(500).json({ message: "Failed to remove team" });
            }

            res.json({
                success: true,
                message: `Team "${group.name}" has been removed. All member student accounts are intact and free to join or form a new team.`
            });
        } catch (error) {
            console.error("Error deleting team:", error);
            res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
        }
    });

    // Remove a single member from a team (Admin and Coordinator only)
    router.delete("/api/student-groups/:groupId/members/:userId", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const groupId = parseInt(req.params.groupId);
            const userId = parseInt(req.params.userId);

            const group = await storage.getGroup(groupId);
            if (!group) return res.status(404).json({ message: "Team not found" });

            const student = await storage.getUser(userId);
            if (!student) return res.status(404).json({ message: "Student not found" });

            await storage.removeStudentFromGroup(userId, groupId);

            await storage.createNotification({
                userId,
                title: "Removed from Project Team",
                message: `You have been removed from the project team "${group.name}" by ${req.user.firstName} ${req.user.lastName}.`
            });

            res.json({
                success: true,
                message: `Student ${student.firstName} ${student.lastName} has been removed from the team.`
            });
        } catch (error) {
            console.error("Error removing member:", error);
            res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
        }
    });

    // Add a single member to a team (Admin and Coordinator only)
    router.post("/api/student-groups/:groupId/members", requireRole([UserRole.COORDINATOR, UserRole.ADMIN]), async (req: Request, res: Response) => {
        if (!isAuthenticatedRequest(req)) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        try {
            const groupId = parseInt(req.params.groupId);
            const { enrollmentNumber, userId } = req.body;

            const group = await storage.getGroup(groupId);
            if (!group) return res.status(404).json({ message: "Team not found" });

            let student: any;
            if (userId) {
                student = await storage.getUser(userId);
            } else if (enrollmentNumber) {
                student = await storage.getUserByEnrollmentNumber(enrollmentNumber);
            }

            if (!student || student.role !== UserRole.STUDENT) {
                return res.status(400).json({ message: "Invalid student or enrollment number" });
            }

            // Check if student already in another team
            const existingGroup = await storage.getUserGroup(student.id);
            if (existingGroup) {
                return res.status(400).json({ message: `Student ${student.firstName} ${student.lastName} is already in team "${existingGroup.name}".` });
            }

            // Check course consistency
            if (group.course && student.course && student.course !== group.course) {
                return res.status(400).json({ message: `Student course (${student.course}) does not match team course (${group.course}).` });
            }

            // Check max size
            const members = await storage.getStudentGroupMembers(groupId);
            const maxLimit = group.course === "MCA" ? 2 : 5;
            if (members.length >= maxLimit) {
                return res.status(400).json({ message: `Team is already at maximum capacity (${maxLimit} members).` });
            }

            await storage.addStudentToGroup(student.id, groupId);

            await storage.createNotification({
                userId: student.id,
                title: "Added to Project Team",
                message: `You have been added to the project team "${group.name}".`
            });

            res.json({
                success: true,
                message: `Student ${student.firstName} ${student.lastName} has been added to "${group.name}".`
            });
        } catch (error) {
            console.error("Error adding member:", error);
            res.status(500).json({ message: error instanceof Error ? error.message : "Internal Server Error" });
        }
    });
}
