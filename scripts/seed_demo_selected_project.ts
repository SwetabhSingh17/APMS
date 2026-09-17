import "dotenv/config";
import { DBStorage } from "../server/db-storage";
import { db } from "../server/db";
import { projectTopics, studentGroups, studentProjects } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function seedDemoProject() {
  const storage = new DBStorage();

  // Find Group 2
  const group = await storage.getGroup(2);
  if (!group) throw new Error("Group 2 not found");

  const members = await storage.getStudentGroupMembers(2);
  console.log(`Found ${members.length} members in Group 2:`, members.map(m => `${m.firstName} ${m.lastName} (${m.enrollmentNumber})`));

  // Find Topic PUGID26001
  const [topic] = await db.select().from(projectTopics).where(eq(projectTopics.topicCode, "PUGID26001"));
  if (!topic) throw new Error("Topic PUGID26001 not found");
  console.log(`Found topic: ${topic.topicCode} - "${topic.title}" proposed by user ${topic.submittedById}`);

  const supervisor = await storage.getUser(topic.submittedById);
  console.log(`Topic supervisor: ${supervisor?.prefix} ${supervisor?.firstName} ${supervisor?.lastName} (${supervisor?.department})`);

  // Assign topic to Group 1 members
  for (const member of members) {
    const existing = await storage.getStudentProjects(member.id);
    if (existing.length === 0) {
      await storage.createStudentProject({
        studentId: member.id,
        topicId: topic.id,
        status: "in_progress",
        progress: 15,
      });
    }
  }

  // Set supervisor on group
  await storage.updateStudentGroupSupervisor(2, topic.submittedById);

  // Now verify getAllProjects
  const allProjects = await storage.getAllProjects("BCA");
  console.log(`\nVerified getAllProjects("BCA") returned ${allProjects.length} projects:`);
  for (const p of allProjects) {
    console.log({
      projectId: p.id,
      studentName: p.student ? `${p.student.firstName} ${p.student.lastName}` : "Unknown",
      enrollment: p.student?.enrollmentNumber,
      topicCode: p.topic?.topicCode,
      topicTitle: p.topic?.title,
      supervisor: p.supervisor ? `${p.supervisor.prefix} ${p.supervisor.firstName} ${p.supervisor.lastName}` : "None",
      supervisorDept: p.supervisor?.department,
    });
  }

  // Verify getPaginatedProjects
  const paginated = await storage.getPaginatedProjects(1, 50, "BCA");
  console.log(`\nVerified getPaginatedProjects returned ${paginated.data.length} projects (total: ${paginated.total})`);

  // Verify getAllStudentGroups
  const allGroups = await storage.getAllStudentGroups();
  const g2 = allGroups.find(g => g.id === 2);
  console.log(`\nVerified Group 2 in getAllStudentGroups:`, {
    groupName: g2?.name,
    supervisor: g2?.supervisor ? `${g2?.supervisor.prefix} ${g2?.supervisor.firstName} ${g2?.supervisor.lastName}` : "None",
    selectedProject: g2?.project,
  });

  console.log("\n✅ Demo selected project seeded and verified successfully!");
}

seedDemoProject().catch(console.error);
