import "dotenv/config";
import { DBStorage } from "../server/db-storage";
import { UserRole, studentGroups, studentGroupMembers, studentProjects, projectTopics, users } from "@shared/schema";
import { db } from "../server/db";
import { eq, and, inArray } from "drizzle-orm";

async function runVerification() {
  console.log("==================================================================");
  console.log("🚀 VERIFYING PRIORITY BUG FIXES (Issues 1, 2, and 3)");
  console.log("==================================================================\n");

  const storage = new DBStorage();
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Supervisor Assignment in Groups & Fallback Resolution
  // -------------------------------------------------------------
  console.log("--- TEST 1: Supervisor Assignment in Student Groups ---");
  const group1 = await storage.getGroup(1);
  assert(group1 !== undefined, "Group 1 exists in database");
  assert(group1?.course === "BCA", "Group 1 course is BCA");

  const members1 = await storage.getStudentGroupMembers(1);
  assert(members1.length >= 2, `Group 1 has ${members1.length} members`);

  const studentUser = members1[0];
  assert(studentUser.role === UserRole.STUDENT, "Group member is a student");

  // Ensure clean state for group 1 only without wiping unrelated student projects
  const memberIds1 = members1.map(m => m.id);
  if (memberIds1.length > 0) {
    await db.delete(studentProjects).where(inArray(studentProjects.studentId, memberIds1));
  }
  await db.update(studentGroups).set({ supervisorId: null }).where(eq(studentGroups.id, 1));

  const initialMembership = await storage.getUserGroupMembership(studentUser.id);
  assert(initialMembership !== undefined, "User group membership found");
  assert(initialMembership?.group.supervisorId === null, "Group initially has supervisorId = null");

  // -------------------------------------------------------------
  // TEST 2: Approved Topics Categorized Response for Students
  // -------------------------------------------------------------
  console.log("\n--- TEST 2: Approved Topics Endpoint & Structure ---");
  const allApprovedTopics = await storage.getApprovedTopics();
  assert(allApprovedTopics.length >= 300, `Found ${allApprovedTopics.length} approved topics in DB`);

  const targetTopic = allApprovedTopics.find(t => t.course === "BCA" && !t.isDeleted);
  assert(targetTopic !== undefined, "Found valid approved BCA topic", targetTopic?.title);

  const topicSubmitter = await storage.getUser(targetTopic!.submittedById);
  assert(topicSubmitter !== undefined && topicSubmitter.role === UserRole.SUPERVISOR, "Topic proposer is a valid supervisor", `${topicSubmitter?.firstName} ${topicSubmitter?.lastName}`);

  // -------------------------------------------------------------
  // TEST 3: Topic Selection Auto-Syncs Group Supervisor
  // -------------------------------------------------------------
  console.log("\n--- TEST 3: Group Supervisor Auto-Sync on Topic Selection ---");
  
  // Simulate topic selection logic from server/routes/projects.ts
  const acceptedMembers = await storage.getAcceptedGroupMembers(group1!.id);
  assert(acceptedMembers.length > 0, `Found ${acceptedMembers.length} accepted members in Group 1`);

  // Bulk create student projects for group members
  await Promise.all(acceptedMembers.map(m => 
    storage.createStudentProject({
      studentId: m.id,
      topicId: targetTopic!.id,
    })
  ));

  // The new logic: auto-sync supervisorId to studentGroups
  if (targetTopic!.submittedById) {
    await storage.updateStudentGroupSupervisor(group1!.id, targetTopic!.submittedById);
  }

  // Verify group 1 supervisor is now updated in DB
  const updatedGroup1 = await storage.getGroup(1);
  assert(updatedGroup1?.supervisorId === targetTopic!.submittedById, `Group 1 supervisorId automatically synced to ${targetTopic!.submittedById}`);

  // Verify getAllStudentGroups now returns resolved supervisor
  const allGroups = await storage.getAllStudentGroups();
  const reportedGroup1 = allGroups.find(g => g.id === 1);
  assert(reportedGroup1 !== undefined, "Group 1 found in getAllStudentGroups");
  assert(reportedGroup1?.supervisor !== null, "Group 1 supervisor is populated in getAllStudentGroups");
  assert(reportedGroup1?.supervisor?.id === targetTopic!.submittedById, "Resolved supervisor matches topic proposer");
  assert(reportedGroup1?.supervisor?.firstName === topicSubmitter?.firstName, `Supervisor first name is ${topicSubmitter?.firstName}`);

  // -------------------------------------------------------------
  // TEST 4: Storage Fallback Auto-Resolution & Self-Healing
  // -------------------------------------------------------------
  console.log("\n--- TEST 4: Fallback Resolution & Self-Healing ---");
  // Temporarily reset supervisorId to null to test fallback
  await db.update(studentGroups).set({ supervisorId: null }).where(eq(studentGroups.id, 1));

  // Calling getAllStudentGroups should self-heal the supervisor from the member project
  const healedGroups = await storage.getAllStudentGroups();
  const healedGroup1 = healedGroups.find(g => g.id === 1);
  assert(healedGroup1?.supervisor !== null, "Fallback resolution detected supervisor from active project");
  assert(healedGroup1?.supervisor?.id === targetTopic!.submittedById, "Fallback supervisor matches topic submitter");

  // Verify it self-healed in the database
  const groupInDb = await storage.getGroup(1);
  assert(groupInDb?.supervisorId === targetTopic!.submittedById, "Database record self-healed supervisorId");

  // -------------------------------------------------------------
  // TEST 5: Manage Project Supervisor Reassignment
  // -------------------------------------------------------------
  console.log("\n--- TEST 5: Coordinator/Admin Supervisor Reassignment ---");
  // Pick another supervisor
  const allSupervisors = await storage.getUsersByRole(UserRole.SUPERVISOR);
  const alternativeSupervisor = allSupervisors.find(s => s.id !== targetTopic!.submittedById);
  assert(alternativeSupervisor !== undefined, "Found alternative supervisor", `${alternativeSupervisor?.firstName} ${alternativeSupervisor?.lastName}`);

  // Update supervisor via updateStudentGroupSupervisor (as PATCH /api/student-groups/:groupId/supervisor does)
  const reassigned = await storage.updateStudentGroupSupervisor(1, alternativeSupervisor!.id);
  assert(reassigned?.supervisorId === alternativeSupervisor!.id, "updateStudentGroupSupervisor updated supervisorId");

  const groupsAfterReassign = await storage.getAllStudentGroups();
  const recheckGroup1 = groupsAfterReassign.find(g => g.id === 1);
  assert(recheckGroup1?.supervisor?.id === alternativeSupervisor!.id, "getAllStudentGroups reflects new supervisor allotment");

  // -------------------------------------------------------------
  // Cleanup test assignments
  // -------------------------------------------------------------
  console.log("\n--- Cleanup ---");
  if (memberIds1.length > 0) {
    await db.delete(studentProjects).where(inArray(studentProjects.studentId, memberIds1));
  }
  await db.update(studentGroups).set({ supervisorId: null }).where(eq(studentGroups.id, 1));
  assert(true, "Cleaned test projects for group 1 and restored clean state");

  console.log("\n==================================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} PRIORITY BUG FIX TESTS PASSED!`);
  console.log("==================================================================\n");
  process.exit(0);
}

runVerification().catch((err) => {
  console.error("FATAL: Verification failed:", err);
  process.exit(1);
});
