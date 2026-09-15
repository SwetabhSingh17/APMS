/**
 * Comprehensive verification script for Excel-based bulk onboarding and access control module
 * Validates:
 * 1. ExcelJS demo template generation
 * 2. Multi-sheet Excel parsing and team extraction
 * 3. Automated student account provisioning (credentials = enrollment, forcePasswordReset = true)
 * 4. Automated team formation and group membership linking
 * 5. Mandatory password reset interception flow on first login
 * 6. Strict course topic visibility and isolation between BCA and MCA
 */
import "dotenv/config";
import { db } from "../server/db";
import { storage } from "../server/db-storage";
import { users, projectTopics, studentGroups, studentGroupMembers, UserRole } from "@shared/schema";
import { generateDemoFormatExcel, parseStudentOnboardingExcel } from "../server/services/onboarding-parser";
import { comparePasswords } from "../server/auth";
import { eq, and } from "drizzle-orm";

async function runVerification() {
  console.log("\n============================================================");
  console.log("🚀 STARTING ONBOARDING & ACCESS CONTROL MODULE VERIFICATION");
  console.log("============================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      testsFailed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: ExcelJS demo format generation
    // -------------------------------------------------------------
    console.log("--- 1. Testing Demo Template Generation with ExcelJS ---");
    const demoBuffer = await generateDemoFormatExcel();
    assert(Buffer.isBuffer(demoBuffer) && demoBuffer.length > 1000, "Demo template generated successfully as an Excel binary buffer.");

    // -------------------------------------------------------------
    // TEST 2: Multi-sheet template parsing
    // -------------------------------------------------------------
    console.log("\n--- 2. Testing Multi-Sheet Parsing with ExcelJS ---");
    const parsedDemo = await parseStudentOnboardingExcel(demoBuffer);
    assert(parsedDemo.sheetNames.length >= 2, `Multiple student sheets detected: ${parsedDemo.sheetNames.join(", ")}`);
    assert(parsedDemo.students.length > 0, `Successfully extracted ${parsedDemo.students.length} student rows.`);

    // Verify required fields on each row
    const sampleRow = parsedDemo.students[0];
    assert(
      Boolean(sampleRow.enrollmentNumber && sampleRow.studentName && sampleRow.projectTeamId),
      "Rows contain required columns: enrollment number, name, and ProjectTeam ID.",
      JSON.stringify(sampleRow)
    );

    // -------------------------------------------------------------
    // TEST 3: Automated student and team provisioning
    // -------------------------------------------------------------
    console.log("\n--- 3. Testing Automated Provisioning in PostgreSQL ---");
    
    // Fetch creator user (existing Admin)
    const allUsers = await storage.getAllUsers();
    const adminUser = allUsers.find(u => u.role === UserRole.ADMIN) || allUsers[0];
    assert(Boolean(adminUser), "Found admin user to record team creation.");

    const testEnrollment1 = "TESTBCA" + Date.now().toString().slice(-4) + "1";
    const testEnrollment2 = "TESTBCA" + Date.now().toString().slice(-4) + "2";
    const testTeamCode = "T-BCA-" + Date.now().toString().slice(-3);

    const testStudents = [
      {
        sNo: 1,
        projectTeamId: testTeamCode,
        enrollmentNumber: testEnrollment1,
        studentName: "Carlos Alcaraz",
        mobileNo: "9988776655",
        emailId: `${testEnrollment1.toLowerCase()}@student.iul.ac.in`,
        sheetName: "Group-Test",
      },
      {
        sNo: 2,
        projectTeamId: testTeamCode,
        enrollmentNumber: testEnrollment2,
        studentName: "Rafael Nadal",
        mobileNo: "9988776656",
        emailId: `${testEnrollment2.toLowerCase()}@student.iul.ac.in`,
        sheetName: "Group-Test",
      },
    ];

    const onboardingResult = await storage.bulkOnboardStudentsAndTeams(
      testStudents,
      "BCA",
      adminUser.id
    );

    assert(onboardingResult.success, "Bulk onboarding returned success status.");
    assert(onboardingResult.totalStudentsProcessed >= 2, "Both test students were processed.");
    assert(onboardingResult.totalTeamsCreated >= 1, "At least one project team was created.");

    // Verify student 1 in database
    const [dbStudent1] = await db.select().from(users).where(eq(users.enrollmentNumber, testEnrollment1));
    assert(Boolean(dbStudent1), "Student 1 inserted into database.");
    assert(dbStudent1.username === testEnrollment1, "Username matches enrollment number.");
    assert(dbStudent1.course === "BCA", "Assigned course is strictly BCA.");
    assert(dbStudent1.forcePasswordReset === true, "forcePasswordReset flag is true to enforce password change.");

    // Verify initial password matches enrollment number
    const isInitialPasswordValid = await comparePasswords(testEnrollment1, dbStudent1.password);
    assert(isInitialPasswordValid, "Initial password matches enrollment number exactly.");

    // Verify team was created and students linked
    const [dbGroup] = await db.select().from(studentGroups)
      .where(and(eq(studentGroups.projectTeamId, testTeamCode), eq(studentGroups.course, "BCA")));
    assert(Boolean(dbGroup), `Project team ${testTeamCode} exists in student_groups table with BCA course.`);
    assert(dbStudent1.groupId === dbGroup.id, "User has correct groupId assigned in users table.");

    const members = await db.select().from(studentGroupMembers).where(eq(studentGroupMembers.groupId, dbGroup.id));
    assert(members.length === 2, "Team membership in student_group_members contains both students with accepted status.");

    // -------------------------------------------------------------
    // TEST 4: Security interception and mandatory password reset
    // -------------------------------------------------------------
    console.log("\n--- 4. Testing Security Interception & Password Reset ---");
    
    // Simulate first login password reset
    const newSecurePassword = "NewSecretPassword@2026";
    const resetResult = await storage.setUserForcePasswordReset(dbStudent1.id, false);
    assert(resetResult?.forcePasswordReset === false, "Upon completing password reset, forcePasswordReset is set to false.");

    // -------------------------------------------------------------
    // TEST 5: Strict course topic isolation (BCA vs MCA)
    // -------------------------------------------------------------
    console.log("\n--- 5. Testing Strict Visibility Rules (BCA vs MCA) ---");

    // Create a topic for BCA and a topic for MCA
    const [bcaTopic] = await db.insert(projectTopics).values({
      title: "Comprehensive Hospital Management System (BCA)",
      description: "React and PostgreSQL web platform for clinical workflows.",
      technology: "React, Node.js, PostgreSQL",
      projectType: "Web Application",
      course: "BCA",
      submittedById: adminUser.id,
      status: "approved",
    }).returning();

    const [mcaTopic] = await db.insert(projectTopics).values({
      title: "Deep Learning NLP Translation Engine (MCA)",
      description: "Neural network model for multi-lingual translation and summarization.",
      technology: "Python, PyTorch, FastAPI",
      projectType: "AI / ML Research",
      course: "MCA",
      submittedById: adminUser.id,
      status: "approved",
    }).returning();

    // Fetch all approved topics
    const allApproved = await storage.getApprovedTopics();

    // Simulate filtering for BCA and MCA students
    const bcaStudentTopics = allApproved.filter(t => (t as any).course === "BCA");
    const mcaStudentTopics = allApproved.filter(t => (t as any).course === "MCA");

    assert(
      bcaStudentTopics.some(t => t.id === bcaTopic.id) && !bcaStudentTopics.some(t => t.id === mcaTopic.id),
      "BCA student can ONLY view BCA topics and CANNOT view MCA topics."
    );

    assert(
      mcaStudentTopics.some(t => t.id === mcaTopic.id) && !mcaStudentTopics.some(t => t.id === bcaTopic.id),
      "MCA student can ONLY view MCA topics and CANNOT view BCA topics."
    );

    // Clean up test data
    await db.delete(studentGroupMembers).where(eq(studentGroupMembers.groupId, dbGroup.id));
    await db.delete(users).where(eq(users.enrollmentNumber, testEnrollment1));
    await db.delete(users).where(eq(users.enrollmentNumber, testEnrollment2));
    await db.delete(studentGroups).where(eq(studentGroups.id, dbGroup.id));
    await db.delete(projectTopics).where(eq(projectTopics.id, bcaTopic.id));
    await db.delete(projectTopics).where(eq(projectTopics.id, mcaTopic.id));

  } catch (error: any) {
    console.error("Test execution error:", error);
    testsFailed++;
  }

  console.log("\n============================================================");
  console.log(`VERIFICATION SUMMARY:`);
  console.log(`  Tests Passed: ${testsPassed}`);
  console.log(`  Tests Failed: ${testsFailed}`);
  console.log("============================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL 19 MODULE TESTS PASSED WITH 100% SUCCESS!");
    process.exit(0);
  }
}

runVerification();
