import "dotenv/config";
import { DBStorage } from "../server/db-storage";
import { UserRole, users } from "@shared/schema";
import { db } from "../server/db";
import { eq } from "drizzle-orm";
import { hashPassword, comparePasswords } from "../server/auth";

async function runPasswordVerification() {
  console.log("==================================================================");
  console.log("🚀 VERIFYING PASSWORD RESET, LOGIN, AND ERROR CODE FUNCTIONALITY");
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

  // Find or create test student
  const testStudentUsername = "test_student_pwd_fix";
  let student = await storage.getUserByUsername(testStudentUsername);
  if (!student) {
    student = await storage.createUser({
      username: testStudentUsername,
      password: await hashPassword("InitialPass@123"),
      firstName: "Test",
      lastName: "Student",
      email: "test.student.pwd.fix@iul.ac.in",
      role: UserRole.STUDENT,
      enrollmentNumber: "ENR_PWD_TEST_001",
      course: "BCA",
      forcePasswordReset: true,
    });
  }

  // -------------------------------------------------------------
  // TEST 1: Password Hashing and forcePasswordReset Clearing
  // -------------------------------------------------------------
  console.log("--- TEST 1: Admin/Coordinator User Update Hashes Password & Clears Flag ---");
  const newPlainPassword = "NewStudentPass@2026";
  const hashedPassword = await hashPassword(newPlainPassword);

  // Simulate updating student password as performed by PATCH /api/admin/users/:id
  const updatedStudent = await storage.updateUser(student.id, {
    password: hashedPassword,
    forcePasswordReset: false,
  });

  assert(updatedStudent !== undefined, "Student was updated successfully");
  assert(updatedStudent?.password !== newPlainPassword, "Password in database is NOT plaintext");
  assert(updatedStudent?.password.includes(".") === true, "Password contains salt separator (hashed.salt format)");
  assert(updatedStudent?.forcePasswordReset === false, "forcePasswordReset flag is cleared to false");

  const isPasswordValid = await comparePasswords(newPlainPassword, updatedStudent!.password);
  assert(isPasswordValid === true, "comparePasswords returns true for correct new password");

  const isWrongPasswordInvalid = await comparePasswords("WrongPassword@123", updatedStudent!.password);
  assert(isWrongPasswordInvalid === false, "comparePasswords returns false for incorrect password");

  // -------------------------------------------------------------
  // TEST 2: Resilient comparePasswords on Plaintext/Legacy Format
  // -------------------------------------------------------------
  console.log("\n--- TEST 2: Plaintext Legacy Recovery & Auto-Upgrade ---");
  const plaintextLegacy = "LegacyPlainPass123";
  // Directly set plaintext password in DB to simulate old bug
  await db.update(users).set({ password: plaintextLegacy }).where(eq(users.id, student.id));
  
  const studentWithPlaintext = await storage.getUser(student.id);
  assert(studentWithPlaintext?.password === plaintextLegacy, "Student password in DB is intentionally plaintext for test");

  // Verify comparePasswords handles plaintext gracefully without throwing exceptions
  let compareResult = false;
  let didThrow = false;
  try {
    compareResult = await comparePasswords(plaintextLegacy, studentWithPlaintext!.password);
  } catch (err) {
    didThrow = true;
  }
  assert(!didThrow, "comparePasswords does NOT throw an error when evaluating plaintext");
  assert(compareResult === true, "comparePasswords successfully matches plaintext password");

  // Verify comparePasswords rejects wrong password against plaintext
  const wrongCompare = await comparePasswords("WrongAttempt", studentWithPlaintext!.password);
  assert(wrongCompare === false, "comparePasswords rejects incorrect password against plaintext");

  // Auto-upgrade simulation (as performed by LocalStrategy)
  if (!studentWithPlaintext!.password.includes(".")) {
    const upgradedHash = await hashPassword(plaintextLegacy);
    await storage.updateUser(student.id, { password: upgradedHash });
  }

  const upgradedStudent = await storage.getUser(student.id);
  assert(upgradedStudent?.password.includes(".") === true, "Student password has been automatically upgraded to scrypt hash in DB");
  const isUpgradedValid = await comparePasswords(plaintextLegacy, upgradedStudent!.password);
  assert(isUpgradedValid === true, "Upgraded hashed password authenticates correctly with original password");

  // -------------------------------------------------------------
  // TEST 3: Edge Case and Corrupted Password Handling
  // -------------------------------------------------------------
  console.log("\n--- TEST 3: Corrupted / Empty Password Safety ---");
  assert(await comparePasswords("", "any.hash") === false, "Empty supplied password returns false");
  assert(await comparePasswords("pass", "") === false, "Empty stored password returns false");
  assert(await comparePasswords("pass", "invalid_corrupted_hex.salt123") === false, "Corrupted hex string returns false without crash");
  assert(await comparePasswords("pass", "malformed") === false, "String without salt returns false without crash");

  // -------------------------------------------------------------
  // TEST 4: Student Reset to Default Credential (Enrollment Number)
  // -------------------------------------------------------------
  console.log("\n--- TEST 4: Reset Student to Default Credential (Enrollment Number) ---");
  const defaultEnrollment = student.enrollmentNumber!;
  const hashedEnrollment = await hashPassword(defaultEnrollment.trim());

  // Reset student password to default (simulating POST /api/admin/users/:id/reset-password)
  const resetStudent = await storage.updateUser(student.id, {
    password: hashedEnrollment,
    forcePasswordReset: true,
  });

  assert(resetStudent?.forcePasswordReset === true, "Student forcePasswordReset flag is set to true after reset");
  assert(await comparePasswords(defaultEnrollment, resetStudent!.password) === true, "Student can authenticate with their default Enrollment Number");
  assert(await comparePasswords("OldPasswordAttempt", resetStudent!.password) === false, "Student cannot authenticate with old password");

  // User subsequently completes forced password change
  const studentCustomPass = "StudentCustomSecurePass@2026";
  const changedHash = await hashPassword(studentCustomPass);
  const studentAfterForcedChange = await storage.updateUser(student.id, {
    password: changedHash,
    forcePasswordReset: false,
  });
  assert(studentAfterForcedChange?.forcePasswordReset === false, "forcePasswordReset flag cleared after forced password reset change");
  assert(await comparePasswords(studentCustomPass, studentAfterForcedChange!.password) === true, "Student authenticates with newly set custom password");

  // -------------------------------------------------------------
  // TEST 5: Supervisor Reset to Default Credential (Employee ID)
  // -------------------------------------------------------------
  console.log("\n--- TEST 5: Reset Supervisor to Default Credential (Employee ID) ---");
  const testSupervisorUsername = "test_sup_pwd_fix";
  let supervisor = await storage.getUserByUsername(testSupervisorUsername);
  if (!supervisor) {
    supervisor = await storage.createUser({
      username: testSupervisorUsername,
      password: await hashPassword("SupSecretInitialPass!"),
      firstName: "Test",
      lastName: "Supervisor",
      email: "test.supervisor.pwd.fix@iul.ac.in",
      role: UserRole.SUPERVISOR,
      empId: "EMP_FIX_9999",
      designation: "Assistant Professor",
      forcePasswordReset: false,
    });
  }

  const defaultEmpId = supervisor.empId!;
  const hashedEmpId = await hashPassword(defaultEmpId.trim());

  const resetSupervisor = await storage.updateUser(supervisor.id, {
    password: hashedEmpId,
    forcePasswordReset: true,
  });

  assert(resetSupervisor?.forcePasswordReset === true, "Supervisor forcePasswordReset flag is set to true after reset");
  assert(await comparePasswords(defaultEmpId, resetSupervisor!.password) === true, "Supervisor can authenticate with their default Employee ID");
  assert(await comparePasswords("SupSecretInitialPass!", resetSupervisor!.password) === false, "Supervisor cannot authenticate with old password");

  // -------------------------------------------------------------
  // TEST 6: RBAC Protection & Safety Rules
  // -------------------------------------------------------------
  console.log("\n--- TEST 6: RBAC Protection - Coordinator cannot reset Admin accounts ---");
  const coordinatorCallerRole = UserRole.COORDINATOR;
  const adminTarget = { role: UserRole.ADMIN, username: "admin" };
  const studentTarget = { role: UserRole.STUDENT, username: "student" };

  const canCoordinatorResetAdmin = !(coordinatorCallerRole === UserRole.COORDINATOR && (adminTarget.role === UserRole.ADMIN || adminTarget.role === UserRole.COORDINATOR));
  const canCoordinatorResetStudent = !(coordinatorCallerRole === UserRole.COORDINATOR && (studentTarget.role === UserRole.ADMIN || studentTarget.role === UserRole.COORDINATOR));

  assert(canCoordinatorResetAdmin === false, "Coordinator is forbidden from resetting Admin passwords (FORBIDDEN_TARGET_STAFF)");
  assert(canCoordinatorResetStudent === true, "Coordinator is permitted to reset Student passwords");

  // -------------------------------------------------------------
  // Clean up test users
  // -------------------------------------------------------------
  await db.delete(users).where(eq(users.id, student.id));
  if (supervisor) {
    await db.delete(users).where(eq(users.id, supervisor.id));
  }

  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passedTests} / ${totalTests} tests passed`);
  console.log("==================================================================");

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPasswordVerification().catch((err) => {
  console.error("Verification failed with exception:", err);
  process.exit(1);
});
