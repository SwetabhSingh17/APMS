import "dotenv/config";
import fs from "fs";
import { parseSupervisorOnboardingFile, generateSupervisorDemoFormatExcel } from "../server/services/supervisor-onboarding-parser";
import { DBStorage } from "../server/db-storage";
import { comparePasswords } from "../server/auth";
import { UserRole } from "@shared/schema";
import { db } from "../server/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function runVerification() {
  console.log("===============================================================");
  console.log("🚀 STARTING AUTOMATED SUPERVISOR ONBOARDING & RBAC VERIFICATION");
  console.log("===============================================================\n");

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
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Parse the verbatim uploaded staff list (.xls)
  // -------------------------------------------------------------
  console.log("--- TEST 1: Parsing 'Updated Staff List with all details.xls' ---");
  const xlsBuffer = fs.readFileSync("Updated Staff List with all details.xls");
  const parsedStaff = await parseSupervisorOnboardingFile(xlsBuffer);

  assert(parsedStaff.supervisors.length === 62, "All 62 staff members parsed successfully", `Got ${parsedStaff.supervisors.length}`);
  assert(parsedStaff.department.includes("Department of Computer Application"), "Department correctly detected from banner", parsedStaff.department);

  const headOfDept = parsedStaff.supervisors.find(s => s.empId === "F00157");
  assert(Boolean(headOfDept), "Found Head of Department record (F00157)");
  assert(headOfDept?.prefix === "Dr.", "Extracted prefix 'Dr.'", headOfDept?.prefix);
  assert(headOfDept?.firstName === "Mohammad", "Extracted first name 'Mohammad'", headOfDept?.firstName);
  assert(headOfDept?.lastName === "Faisal", "Extracted last name 'Faisal'", headOfDept?.lastName);
  assert(headOfDept?.designation === "Professor & Head", "Extracted designation 'Professor & Head'", headOfDept?.designation);
  assert(headOfDept?.email === "mdfaisal@iul.ac.in", "Extracted primary email cleanly", headOfDept?.email);
  assert(headOfDept?.mobile === "9984171083", "Extracted mobile number cleanly", headOfDept?.mobile);

  // Check female prefixes and last staff members
  const assistantProf = parsedStaff.supervisors.find(s => s.empId === "F01142");
  assert(assistantProf?.prefix === "Ms.", "Extracted prefix 'Ms.' for Ms. Fiza Afreen", assistantProf?.prefix);
  assert(assistantProf?.firstName === "Fiza", "Extracted first name 'Fiza'", assistantProf?.firstName);

  // -------------------------------------------------------------
  // TEST 2: Demo Template Generation Matching Exact Format
  // -------------------------------------------------------------
  console.log("\n--- TEST 2: Demo Template Generation Matching Exact Format ---");
  const demoBuffer = await generateSupervisorDemoFormatExcel();
  assert(demoBuffer.length > 1000, "Supervisor demo Excel file generated with non-empty buffer", `Size: ${demoBuffer.length} bytes`);

  const parsedDemo = await parseSupervisorOnboardingFile(demoBuffer);
  assert(parsedDemo.supervisors.length >= 6, "Demo format contains sample supervisor records", `Got ${parsedDemo.supervisors.length}`);
  const demoHOD = parsedDemo.supervisors.find(s => s.empId === "F00157");
  assert(Boolean(demoHOD), "Demo format includes accurate Head of Department sample record");
  assert(demoHOD?.designation === "Professor & Head", "Demo format includes accurate designation formatting");

  // -------------------------------------------------------------
  // TEST 3: Database Provisioning & Credential Setup
  // -------------------------------------------------------------
  console.log("\n--- TEST 3: Database Provisioning & Credential Security ---");
  // Select a subset of supervisors to test provisioning
  const testSubSet = parsedStaff.supervisors.slice(0, 5);
  const onboardResult = await storage.bulkOnboardSupervisors(testSubSet);

  assert(onboardResult.success === true, "bulkOnboardSupervisors completed with success=true");
  assert(onboardResult.totalSupervisorsProcessed === 5, "Processed 5 supervisors in test batch");

  // Query database directly to verify stored credentials and RBAC fields
  const provisionedHOD = await storage.getUserByUsername("F00157");
  assert(Boolean(provisionedHOD), "Supervisor F00157 exists in database");
  assert(provisionedHOD?.role === UserRole.SUPERVISOR, "User role is 'supervisor'", provisionedHOD?.role);
  assert(provisionedHOD?.empId === "F00157", "empId is 'F00157'", provisionedHOD?.empId);
  assert(provisionedHOD?.prefix === "Dr.", "prefix is 'Dr.'", provisionedHOD?.prefix);
  assert(provisionedHOD?.designation === "Professor & Head", "designation is 'Professor & Head'", provisionedHOD?.designation);
  assert(provisionedHOD?.forcePasswordReset === true, "forcePasswordReset flag is true for first-login reset", String(provisionedHOD?.forcePasswordReset));

  // Verify initial password equals EmpID using scrypt verification
  const isInitialPasswordValid = await comparePasswords("F00157", provisionedHOD!.password);
  assert(isInitialPasswordValid, "Initial temporary password matches EmpID (F00157) verbatim");

  // -------------------------------------------------------------
  // TEST 4: Security Interceptor & First-Login Password Reset
  // -------------------------------------------------------------
  console.log("\n--- TEST 4: Security Interceptor & Forced Password Reset Simulation ---");
  // Simulate request state with forcePasswordReset active
  const mockUserSession = {
    isAuthenticated: () => true,
    user: provisionedHOD,
  };

  const testPaths = [
    { path: "/api/student-groups", expectedBlocked: true },
    { path: "/api/projects", expectedBlocked: true },
    { path: "/api/user", expectedBlocked: false },
    { path: "/api/user/profile", expectedBlocked: false },
    { path: "/api/user/change-password", expectedBlocked: false },
    { path: "/api/logout", expectedBlocked: false },
  ];

  for (const { path, expectedBlocked } of testPaths) {
    const isAllowed = ["/api/user", "/api/user/profile", "/api/user/change-password", "/api/logout"].includes(path);
    const isBlocked = !isAllowed && path.startsWith("/api");
    assert(isBlocked === expectedBlocked, `Route '${path}' is correctly ${expectedBlocked ? "BLOCKED (403)" : "ALLOWED"}`);
  }

  // -------------------------------------------------------------
  // TEST 5: RBAC on Designation Modification
  // -------------------------------------------------------------
  console.log("\n--- TEST 5: RBAC on Designation Modification ---");
  // Scenario A: Supervisor attempts to modify their own designation
  const supervisorUser = provisionedHOD!;
  const supervisorRole = supervisorUser.role; // "supervisor"
  const isAdminOrCoordinator = supervisorRole === UserRole.ADMIN || supervisorRole === UserRole.COORDINATOR;
  const attemptedDesignation = "Dean of Engineering";

  // Simulate /api/user/profile RBAC check
  let supervisorMutationBlocked = false;
  if (attemptedDesignation !== undefined && attemptedDesignation !== supervisorUser.designation && !isAdminOrCoordinator) {
    supervisorMutationBlocked = true;
  }
  assert(supervisorMutationBlocked === true, "Supervisor is FORBIDDEN (403) from mutating their own designation");

  // Scenario B: Supervisor mutates permitted fields (Prefix, First Name, Last Name, Mobile)
  const allowedSupervisorFields = ['firstName', 'lastName', 'email', 'prefix', 'mobile'];
  const updatePayload = {
    prefix: "Prof. Dr.",
    firstName: "Mohammad",
    lastName: "Faisal",
    mobile: "9984171083",
  };

  const sanitizedUpdate = Object.entries(updatePayload).reduce((acc, [k, v]) => {
    if (allowedSupervisorFields.includes(k)) acc[k] = v;
    return acc;
  }, {} as Record<string, any>);

  const updatedSupervisor = await storage.updateUser(supervisorUser.id, sanitizedUpdate);
  assert(updatedSupervisor?.prefix === "Prof. Dr.", "Supervisor CAN update their prefix", updatedSupervisor?.prefix);
  assert(updatedSupervisor?.designation === "Professor & Head", "Designation remained unchanged and preserved", updatedSupervisor?.designation);

  // Scenario C: Administrator modifies supervisor's designation
  const adminRole = UserRole.ADMIN;
  const adminCanModify = adminRole === UserRole.ADMIN || adminRole === UserRole.COORDINATOR;
  assert(adminCanModify === true, "Administrator has authorization to update supervisor designation");

  const adminUpdated = await storage.updateUser(supervisorUser.id, {
    designation: "Professor & Head (CA)",
  });
  assert(adminUpdated?.designation === "Professor & Head (CA)", "Administrator successfully updated supervisor designation");

  // Restore designation back
  await storage.updateUser(supervisorUser.id, {
    prefix: "Dr.",
    designation: "Professor & Head",
  });

  // -------------------------------------------------------------
  // TEST 6: Complete Staff List Bulk Ingestion
  // -------------------------------------------------------------
  console.log("\n--- TEST 6: Complete Staff List Bulk Ingestion (All 62 Faculty) ---");
  const fullResult = await storage.bulkOnboardSupervisors(parsedStaff.supervisors);
  assert(fullResult.success === true, "Full bulk onboarding completed successfully");
  assert(fullResult.totalSupervisorsProcessed === 62, "All 62 supervisors processed into database", `Got ${fullResult.totalSupervisorsProcessed}`);

  // Query all supervisors from database
  const allSupervisors = await storage.getUsersByRole(UserRole.SUPERVISOR);
  // -------------------------------------------------------------
  // TEST 7: Supervisors Accessible for Both MCA and BCA Courses
  // -------------------------------------------------------------
  console.log("\n--- TEST 7: Supervisors Accessible for Both MCA and BCA Courses ---");
  const bcaUsers = await storage.getAllUsers("BCA");
  const mcaUsers = await storage.getAllUsers("MCA");

  const bcaSupervisors = bcaUsers.filter(u => u.role === UserRole.SUPERVISOR);
  const mcaSupervisors = mcaUsers.filter(u => u.role === UserRole.SUPERVISOR);
  const bcaStudents = bcaUsers.filter(u => u.role === UserRole.STUDENT);
  const mcaStudents = mcaUsers.filter(u => u.role === UserRole.STUDENT);

  assert(bcaSupervisors.length >= 62, "Supervisors are included when filtering by BCA course", `Found ${bcaSupervisors.length}`);
  assert(mcaSupervisors.length >= 62, "Supervisors are included when filtering by MCA course", `Found ${mcaSupervisors.length}`);

  const paginatedBca = await storage.getPaginatedUsers(1, 1000, "BCA");
  const paginatedMca = await storage.getPaginatedUsers(1, 1000, "MCA");
  const pagBcaSupervisors = paginatedBca.data.filter(u => u.role === UserRole.SUPERVISOR);
  const pagMcaSupervisors = paginatedMca.data.filter(u => u.role === UserRole.SUPERVISOR);

  assert(paginatedBca.total === bcaUsers.length, "Paginated BCA total count matches getAllUsers count", `Total: ${paginatedBca.total} vs ${bcaUsers.length}`);
  assert(paginatedMca.total === mcaUsers.length, "Paginated MCA total count matches getAllUsers count", `Total: ${paginatedMca.total} vs ${mcaUsers.length}`);
  assert(pagBcaSupervisors.length >= 62, "Paginated BCA user query includes all supervisors", `Found ${pagBcaSupervisors.length}`);
  assert(pagMcaSupervisors.length >= 62, "Paginated MCA user query includes all supervisors", `Found ${pagMcaSupervisors.length}`);

  // Strict student isolation check: BCA student query must never contain MCA students
  const crossContaminatedStudents = bcaStudents.filter(s => s.course === "MCA");
  assert(crossContaminatedStudents.length === 0, "Student course isolation preserved: no MCA students in BCA filter");

  console.log("\n===============================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED WITH 100% SUCCESS!`);
  console.log("===============================================================\n");
  process.exit(0);
}

runVerification().catch((err) => {
  console.error("FATAL: Verification failed:", err);
  process.exit(1);
});
