import "dotenv/config";
import axios from "axios";

const BASE_URL = "http://localhost:3000";

async function verify() {
  console.log("==================================================================");
  console.log("🚀 VERIFYING ADMIN & COORDINATOR PROJECT & PROGRESS TRACKING");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, desc: string, detail?: any) {
    if (cond) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`, detail || "");
      failed++;
    }
  }

  // 1. Test Admin Login & Endpoints
  console.log("--- 1. Testing Admin Authentication & Data Visibility ---");
  const adminClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
  });

  const adminLoginRes = await adminClient.post("/api/login", {
    username: "admin",
    password: "Admin@123",
  });
  assert(adminLoginRes.status === 200, "Admin login successful");
  const adminCookie = adminLoginRes.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; ");

  // Fetch /api/projects (Projects page data)
  const adminProjectsRes = await adminClient.get("/api/projects?limit=all", {
    headers: { Cookie: adminCookie },
  });
  assert(adminProjectsRes.status === 200, "GET /api/projects?limit=all returned 200 OK");
  const projectsData = Array.isArray(adminProjectsRes.data) ? adminProjectsRes.data : adminProjectsRes.data.data;
  assert(Array.isArray(projectsData) && projectsData.length > 0, `Admin sees ${projectsData?.length} student projects (NOT empty)`);

  const sampleProj = projectsData[0];
  assert(!!sampleProj.topic, "Project has associated topic object");
  assert(sampleProj.topic?.topicCode === "PUGID26001", "Project topic code matches 'PUGID26001'", sampleProj.topic?.topicCode);
  assert(sampleProj.topic?.title === "Requirement Change Impact Prediction System", "Project title matches topic title");
  assert(!!sampleProj.student, "Project has student object attached");
  assert(!!sampleProj.student?.enrollmentNumber, "Student enrollment number populated", sampleProj.student?.enrollmentNumber);
  assert(!!sampleProj.supervisor, "Project has supervisor object attached");
  assert(sampleProj.supervisor?.prefix === "Dr.", "Supervisor has prefix 'Dr.'", sampleProj.supervisor?.prefix);
  assert(sampleProj.supervisor?.firstName === "Syed", "Supervisor firstName matches 'Syed'");
  assert(sampleProj.supervisor?.lastName === "Adnan Afaq", "Supervisor lastName matches 'Adnan Afaq'");
  assert(!!sampleProj.supervisor?.department, "Supervisor department populated", sampleProj.supervisor?.department);

  // Fetch /api/student-groups (Manage Projects page data)
  const adminGroupsRes = await adminClient.get("/api/student-groups", {
    headers: { Cookie: adminCookie },
  });
  assert(adminGroupsRes.status === 200, "GET /api/student-groups returned 200 OK");
  const group2 = adminGroupsRes.data.find((g: any) => g.id === 2);
  assert(!!group2, "Found Group 2 (Project Team A-02)");
  assert(group2.supervisor?.prefix === "Dr.", "Group 2 supervisor has prefix 'Dr.'", group2.supervisor?.prefix);
  const g2SupName = `${group2.supervisor?.prefix ? `${group2.supervisor.prefix} ` : ""}${group2.supervisor?.firstName} ${group2.supervisor?.lastName}`.trim();
  assert(g2SupName === "Dr. Syed Adnan Afaq", "Group 2 supervisor matches Dr. Syed Adnan Afaq", g2SupName);
  assert(!!group2.project, "Group 2 has selected project attached");
  assert(group2.project?.topicCode === "PUGID26001", "Group 2 selected project code is 'PUGID26001'", group2.project?.topicCode);
  assert(group2.project?.topicTitle === "Requirement Change Impact Prediction System", "Group 2 project title matches");

  // 2. Test Coordinator Login & Endpoints
  console.log("\n--- 2. Testing Coordinator Authentication & Data Visibility ---");
  const coordClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
  });

  const coordLoginRes = await coordClient.post("/api/login", {
    username: "coordinator",
    password: "Admin@123",
  });
  assert(coordLoginRes.status === 200, "Coordinator login successful");
  const coordCookie = coordLoginRes.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; ");

  // Fetch /api/projects as Coordinator
  const coordProjectsRes = await coordClient.get("/api/projects?limit=all", {
    headers: { Cookie: coordCookie },
  });
  assert(coordProjectsRes.status === 200, "Coordinator GET /api/projects?limit=all returned 200 OK");
  const coordProjectsData = Array.isArray(coordProjectsRes.data) ? coordProjectsRes.data : coordProjectsRes.data.data;
  assert(Array.isArray(coordProjectsData) && coordProjectsData.length > 0, `Coordinator sees ${coordProjectsData?.length} student projects (NOT empty)`);

  const coordSampleProj = coordProjectsData[0];
  assert(coordSampleProj.topic?.topicCode === "PUGID26001", "Coordinator sees project PUGID26001");
  assert(coordSampleProj.supervisor?.prefix === "Dr.", "Coordinator sees supervisor prefix 'Dr.'");
  const coordSupName = `${coordSampleProj.supervisor?.prefix ? `${coordSampleProj.supervisor.prefix} ` : ""}${coordSampleProj.supervisor?.firstName} ${coordSampleProj.supervisor?.lastName}`.trim();
  assert(coordSupName === "Dr. Syed Adnan Afaq", "Coordinator sees supervisor name 'Dr. Syed Adnan Afaq'", coordSupName);

  // Fetch /api/student-groups as Coordinator
  const coordGroupsRes = await coordClient.get("/api/student-groups", {
    headers: { Cookie: coordCookie },
  });
  assert(coordGroupsRes.status === 200, "Coordinator GET /api/student-groups returned 200 OK");
  const coordGroup2 = coordGroupsRes.data.find((g: any) => g.id === 2);
  assert(!!coordGroup2?.project, "Coordinator sees Group 2 selected project");
  assert(coordGroup2?.project?.topicCode === "PUGID26001", "Coordinator sees Group 2 project code 'PUGID26001'");

  console.log("\n==================================================================");
  console.log(`SUMMARY: Passed ${passed}/${passed + failed} assertions`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
}

verify().catch(err => {
  console.error("FATAL verification error:", err.response?.data || err.message);
  process.exit(1);
});
