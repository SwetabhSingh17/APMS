import "dotenv/config";
import { DBStorage } from "../server/db-storage";
import { db } from "../server/db";
import { users, projectTopics, studentProjects } from "@shared/schema";
import { eq } from "drizzle-orm";

async function check() {
  const storage = new DBStorage();
  const approvedTopics = await storage.getApprovedTopics();
  console.log("Approved topics count from storage:", approvedTopics.length);

  // Check a sample student
  const [student] = await db.select().from(users).where(eq(users.role, "student")).limit(1);
  console.log("Sample student:", {
    id: student?.id,
    name: `${student?.firstName} ${student?.lastName}`,
    course: student?.course,
    role: student?.role,
    groupId: student?.groupId
  });

  const studentProjectsList = await storage.getStudentProjects(student.id);
  console.log("Student projects count:", studentProjectsList.length);

  const allProjects = await storage.getAllProjects();
  console.log("All projects count:", allProjects.length);

  let topics = approvedTopics;
  const studentCourse = student.course;
  if (studentCourse && (studentCourse === "BCA" || studentCourse === "MCA")) {
    topics = topics.filter(t => (t as any).course === studentCourse);
  } else {
    topics = [];
  }

  const hasSelectedTopic = studentProjectsList.length > 0;
  const myTopicId = hasSelectedTopic ? studentProjectsList[0].topicId : null;
  const takenTopicIds = allProjects
    .filter(p => p.topicId !== myTopicId)
    .map(p => p.topicId);

  const myTopic = myTopicId ? topics.find(t => t.id === myTopicId) : null;
  const availableTopics = topics.filter(
    t => !takenTopicIds.includes(t.id) && t.id !== myTopicId
  );
  const takenTopics = topics.filter(
    t => takenTopicIds.includes(t.id)
  );

  console.log("Student view result:", {
    hasSelectedTopic,
    myTopic: myTopic?.title,
    availableTopicsCount: availableTopics.length,
    takenTopicsCount: takenTopics.length
  });

  process.exit(0);
}

check();
