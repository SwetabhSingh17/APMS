import fetch from 'node-fetch';

const createUser = async (username, password, role, enrollmentNumber = null) => {
  const response = await fetch('http://localhost:3000/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      password,
      firstName: username,
      lastName: 'User',
      email: `${username}@example.com`,
      role,
      department: 'Engineering',
      enrollmentNumber,
    }),
  });

  if (!response.ok) {
    console.error(`Failed to create user ${username}:`, await response.text());
  } else {
    console.log(`User ${username} created successfully.`);
  }
};

const createUsers = async () => {
  // Create teacher accounts
  for (let i = 1; i <= 5; i++) {
    await createUser(`teacher${i}`, 'teacher123', 'teacher');
  }

  // Create student accounts
  for (let i = 1; i <= 10; i++) {
    await createUser(`student${i}`, 'student123', 'student', `ENROLL${i}`);
  }
};

createUsers().catch(console.error); 