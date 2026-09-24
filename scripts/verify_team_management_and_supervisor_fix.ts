import "dotenv/config";
import { DBStorage } from "../server/db-storage";
import { UserRole, studentGroups, studentGroupMembers, users, notifications } from "@shared/schema";
import { db } from "../server/db";
import { eq, inArray } from "drizzle-orm";

async function runVerification() {
  console.log("==================================================================");
  console.log("🚀 VERIFYING TEAM MANAGEMENT & SUPERVISOR OPTIONAL FIX");
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

  try {
    // Find an admin user
    const [adminUser] = await storage.getUsersByRole(UserRole.ADMIN);
    assert(adminUser !== undefined, "Admin user exists in database");

    // 1. Create a dummy test student who is not in any team
    const testEnrollment = `TEST_ENROLL_${Date.now()}`;
    const testUsername = `test_student_${Date.now()}`;
    const [testStudent] = await db.insert(users).values({
      username: testUsername,
      password: "TestPassword123!",
      firstName: "Test",
      lastName: "Student",
      email: `${testUsername}@example.com`,
      role: UserRole.STUDENT,
      enrollmentNumber: testEnrollment,
      course: "BCA",
      groupId: null,
    }).returning();
    assert(testStudent !== undefined, "Test student created without team");

    // 2. TEST: Create student group WITHOUT supervisor (supervisorId = null)
    console.log("\n--- TEST 1: Create Team with NO Supervisor ---");
    const testGroupName = `Test No-Supervisor Team ${Date.now()}`;
    const newGroup = await storage.createStudentGroup({
      name: testGroupName,
      description: "Testing team creation without mandatory supervisor",
      supervisorId: null,
      maxSize: 5,
      course: "BCA",
    } as any, adminUser.id, [testEnrollment], true);

    assert(newGroup !== undefined && newGroup.id > 0, "Team created successfully without supervisor");
    assert(newGroup.supervisorId === null, "Team supervisorId is explicitly null");

    // Verify student is now in the group
    const studentAfterJoin = await storage.getUser(testStudent.id);
    assert(studentAfterJoin?.groupId === newGroup.id, "Student user account has groupId pointing to new team");

    // 3. TEST: Update team details
    console.log("\n--- TEST 2: Update Team Details ---");
    const updatedName = `${testGroupName} (Updated)`;
    const updatedGroup = await storage.updateStudentGroup(newGroup.id, {
      name: updatedName,
      description: "Updated description for test team",
    });
    assert(updatedGroup?.name === updatedName, "Team name updated successfully");

    // 4. TEST: Remove member from team
    console.log("\n--- TEST 3: Remove Member From Team ---");
    const removeSuccess = await storage.removeStudentFromGroup(testStudent.id, newGroup.id);
    assert(removeSuccess === true, "Member removed from team successfully");

    const studentAfterRemoval = await storage.getUser(testStudent.id);
    assert(studentAfterRemoval !== undefined, "Student user account still exists (NOT deleted)");
    assert(studentAfterRemoval?.groupId === null, "Student groupId is now null and free to join a new team");
    assert(studentAfterRemoval?.isDeleted === false, "Student isDeleted flag is false (active account)");

    // 5. TEST: Add member back to team
    console.log("\n--- TEST 4: Add Member Back to Team ---");
    const addSuccess = await storage.addStudentToGroup(testStudent.id, newGroup.id);
    assert(addSuccess === true, "Student added back to team successfully");

    const studentAfterRejoin = await storage.getUser(testStudent.id);
    assert(studentAfterRejoin?.groupId === newGroup.id, "Student groupId successfully reassociated with team");

    // 6. TEST: Dissolve / Remove Team Completely
    console.log("\n--- TEST 5: Dissolve / Remove Team with User Account Preservation ---");
    const deleteSuccess = await storage.deleteStudentGroup(newGroup.id);
    assert(deleteSuccess === true, "Team deleted successfully");

    const groupAfterDelete = await storage.getGroup(newGroup.id);
    assert(groupAfterDelete === undefined, "Team record is deleted from studentGroups");

    const studentAfterTeamDelete = await storage.getUser(testStudent.id);
    assert(studentAfterTeamDelete !== undefined, "Student user account STILL EXISTS after team removal");
    assert(studentAfterTeamDelete?.groupId === null, "Student groupId is reset to null after team removal");
    assert(studentAfterTeamDelete?.isDeleted === false, "Student account remains 100% active and preserved");

    // Cleanup the test student record
    await db.delete(notifications).where(eq(notifications.userId, testStudent.id));
    await db.delete(users).where(eq(users.id, testStudent.id));
    console.log("\nCleaned up temporary test student record and notifications.");

    console.log("\n==================================================================");
    console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} tests passed`);
    console.log("==================================================================");

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error("Verification failed with error:", err);
    process.exit(1);
  }
}

runVerification();
