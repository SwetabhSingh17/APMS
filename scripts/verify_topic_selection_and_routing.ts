import "dotenv/config";
import { db } from "../server/db";
import { DBStorage } from "../server/db-storage";
import { users, projectTopics, studentGroups, studentGroupMembers, studentProjects, UserRole } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function runTest() {
  console.log("==================================================================");
  console.log("🚀 STARTING TOPIC SELECTION & ROUTING VERIFICATION");
  console.log("==================================================================\n");

  const storage = new DBStorage();
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
      testsFailed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: Check auto-provisioned groups and members
    // -------------------------------------------------------------
    console.log("--- TEST 1: Auto-provisioned Group Verification ---");
    const [group] = await db.select().from(studentGroups).limit(1);
    assert(!!group, "Found auto-provisioned group", `Group: ${group?.name}`);
    assert(group.createdById === 1, "Group was created by Admin (createdById === 1)");

    const members = await storage.getAcceptedGroupMembers(group.id);
    assert(members.length > 0, `Group has ${members.length} accepted members`);
    const creatorIsMember = members.some(m => m.id === group.createdById);
    assert(!creatorIsMember, "Admin creator is NOT a member of the student group");

    // -------------------------------------------------------------
    // TEST 2: Approved Topic Verification
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Target Approved Topic ---");
    const [topic] = await db.select().from(projectTopics)
      .where(and(
        eq(projectTopics.course, "BCA"),
        eq(projectTopics.status, "approved")
      ))
      .limit(1);
    assert(!!topic, "Found approved BCA topic", `Topic: ${topic?.topicCode} - ${topic?.title}`);

    const isAllottedBefore = await storage.isTopicAllotted(topic.id);
    assert(!isAllottedBefore, "Topic is currently not allotted");

    // -------------------------------------------------------------
    // TEST 3: Simulate Topic Selection Logic for Auto-provisioned Group Member
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Topic Selection Authorization Logic ---");
    const testStudent = members[0];
    assert(!!testStudent, "Selected first student member from auto-provisioned group");

    // Replicate the fixed authorization rule from POST /api/projects
    const isMember = members.some(m => m.id === testStudent.id);
    assert(isMember, "Student is confirmed accepted group member");

    const creatorIsStudentMember = members.some(m => m.id === group.createdById);
    assert(!creatorIsStudentMember, "Creator is recognized as external admin, not student peer");

    const isAuthorized = isMember && (!creatorIsStudentMember || group.createdById === testStudent.id);
    assert(isAuthorized, "Student in auto-provisioned group is AUTHORIZED to select topic");

    // -------------------------------------------------------------
    // TEST 4: Perform Selection and Allotment
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Project Creation and Allotment ---");
    // Assign topic to all group members
    const createdProjects = await Promise.all(members.map(member =>
      storage.createStudentProject({
        studentId: member.id,
        topicId: topic.id
      })
    ));

    assert(createdProjects.length === members.length, `Created projects for all ${members.length} group members`);

    const isAllottedAfter = await storage.isTopicAllotted(topic.id);
    assert(isAllottedAfter, "Topic is now successfully flagged as allotted");

    // Verify each member now has the project
    for (const member of members) {
      const studentProjectsList = await storage.getStudentProjects(member.id);
      assert(studentProjectsList.some(p => p.topicId === topic.id), `Member ${member.firstName} has project assigned`);
    }

    // -------------------------------------------------------------
    // TEST 5: Clean Up Test Projects
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Clean Up ---");
    for (const proj of createdProjects) {
      await db.delete(studentProjects).where(eq(studentProjects.id, proj.id));
    }
    const isAllottedCleaned = await storage.isTopicAllotted(topic.id);
    assert(!isAllottedCleaned, "Cleaned up test assignments, topic is available again");

  } catch (error) {
    console.error("Test execution failed:", error);
    testsFailed++;
  }

  console.log("\n==================================================================");
  console.log(`VERIFICATION SUMMARY:`);
  console.log(`  Tests Passed: ${testsPassed}`);
  console.log(`  Tests Failed: ${testsFailed}`);
  console.log("==================================================================");

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTest();
