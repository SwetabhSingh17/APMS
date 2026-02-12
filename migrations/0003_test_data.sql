-- Insert test users
INSERT INTO users (username, password, first_name, last_name, email, role, department, enrollment_number)
VALUES 
  ('teacher1', '$2b$10$6jM7G7eHH.zcYgS2wvLN8OgxAFtF1Qf8nJvYxIPtEeqvL7Y.MXUS.', 'Jane', 'Smith', 'jane.smith@example.com', 'teacher', 'Computer Science', NULL),
  ('student1', '$2b$10$6jM7G7eHH.zcYgS2wvLN8OgxAFtF1Qf8nJvYxIPtEeqvL7Y.MXUS.', 'John', 'Doe', 'john.doe@example.com', 'student', 'Computer Science', 'CS2023001'),
  ('student2', '$2b$10$6jM7G7eHH.zcYgS2wvLN8OgxAFtF1Qf8nJvYxIPtEeqvL7Y.MXUS.', 'Alice', 'Johnson', 'alice.johnson@example.com', 'student', 'Computer Science', 'CS2023002');

-- Insert test project topics
INSERT INTO project_topics (title, description, submitted_by_id, department, estimated_complexity, status, feedback)
SELECT 
  'Machine Learning Project',
  'A project to implement various machine learning algorithms',
  id,
  'Computer Science',
  'Medium',
  'approved',
  'Good project proposal'
FROM users WHERE username = 'teacher1';

INSERT INTO project_topics (title, description, submitted_by_id, department, estimated_complexity, status, feedback)
SELECT 
  'Web Development Project',
  'A full-stack web application using modern technologies',
  id,
  'Computer Science',
  'High',
  'approved',
  'Excellent project idea'
FROM users WHERE username = 'teacher1';

-- Insert test student projects
INSERT INTO student_projects (student_id, topic_id, status, progress)
SELECT 
  u.id,
  pt.id,
  'in_progress',
  35
FROM users u, project_topics pt
WHERE u.username = 'student1'
AND pt.title = 'Machine Learning Project';

INSERT INTO student_projects (student_id, topic_id, status, progress)
SELECT 
  u.id,
  pt.id,
  'in_progress',
  20
FROM users u, project_topics pt
WHERE u.username = 'student2'
AND pt.title = 'Web Development Project'; 