
import { strict as assert } from 'assert';
import fs from 'fs/promises';

const BASE_URL = 'http://localhost:3000';
const COOKIE_JAR: Record<string, string> = {};

// Helper to manage sessions
async function request(method: string, path: string, body?: any, asUser?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (asUser && COOKIE_JAR[asUser]) {
        headers['Cookie'] = COOKIE_JAR[asUser];
    }

    try {
        const response = await fetch(`${BASE_URL}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        // Capture cookies
        const setCookie = response.headers.get('set-cookie');
        if (setCookie && asUser) {
            const cookies = setCookie.split(',').map(c => c.split(';')[0]);
            COOKIE_JAR[asUser] = cookies.join('; ');
        }

        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        return { status: response.status, data };
    } catch (e) {
        console.error(`Fetch error ${method} ${path}:`, e);
        throw e;
    }
}

// Data Configurations
const PASSWORDS = {
    ADMIN: 'Admin@123',
    COORD: 'Coord@123',
    DEFAULT: 'Pass@123'
};

const USERS: Record<string, any> = {
    admin: { username: 'admin', password: PASSWORDS.ADMIN, role: 'admin', firstName: 'System', lastName: 'Admin', email: 'admin_email' },
    coord: { username: 'coordinator', password: PASSWORDS.COORD, role: 'coordinator', firstName: 'Project', lastName: 'Coordinator', email: 'coord_email', enrollmentNumber: 'COORD01' },
    fac_a: { username: 'faculty_a', password: PASSWORDS.DEFAULT, role: 'teacher', firstName: 'Faculty', lastName: 'A', email: 'fac_a_email', enrollmentNumber: 'FACA' },
    fac_b: { username: 'faculty_b', password: PASSWORDS.DEFAULT, role: 'teacher', firstName: 'Faculty', lastName: 'B', email: 'fac_b_email', enrollmentNumber: 'FACB' },
    fac_c: { username: 'faculty_c', password: PASSWORDS.DEFAULT, role: 'teacher', firstName: 'Faculty', lastName: 'C', email: 'fac_c_email', enrollmentNumber: 'FACC' },
};

// Students E001-E009
for (let i = 1; i <= 9; i++) {
    const num = `E00${i}`;
    USERS[`stu_${i}`] = {
        username: `student_${i}`,
        password: PASSWORDS.DEFAULT,
        role: 'student',
        firstName: 'Student',
        lastName: `${i}`,
        email: `${num.toLowerCase()}@test.com`,
        enrollmentNumber: num
    };
}

const TOPICS = {
    A: { title: 'Topic A - AI Robotics', description: 'Autonomous navigation', technology: 'Python, ROS', projectType: 'Research', owner: 'fac_a' },
    B: { title: 'Topic B - Blockchain Voting', description: 'Decentralized voting', technology: 'Solidity', projectType: 'Development', owner: 'fac_b' },
    C: { title: 'Topic C - Simple Calculator', description: 'Basic calculator', technology: 'HTML/JS', projectType: 'Mini Project', owner: 'fac_c' }
};

async function runSeed() {
    console.log('🌱 Starting Seed Script via API...');

    try {
        // --- Step 0: Initial Reset ---
        console.log('\n🧹 Step 0: Cleaning Database...');
        // Try login as default admin to reset
        let res = await request('POST', '/auth/login', { username: 'admin', password: PASSWORDS.ADMIN }, 'admin');
        if (res.status === 200) {
            console.log('   Logged in as Admin. Triggering Reset...');
            await request('POST', '/api/admin/reset', { password: PASSWORDS.ADMIN }, 'admin');
            console.log('   ✅ System Reset Successful.');
        } else {
            console.log('   Login failed. Assuming fresh DB or wrong creds. Continuing to creation...');
            // Need to ensure admin exists if login failed? 
            // If DB is fresh/empty, Admin might not exist? 
            // Actually, my server code typically seeds default admin on startup or handles it?
            // "e2e_verify" assumes admin exists.
            // If login failed, we might be in trouble if we can't reset.
            // But let's assume standard state (Admin@123).
        }

        // Re-login as Admin (after reset, password is restored to Admin@123)
        res = await request('POST', '/auth/login', { username: 'admin', password: PASSWORDS.ADMIN }, 'admin');
        if (res.status !== 200) throw new Error("CRITICAL: Cannot login as Admin after reset.");

        // --- Step 1: Create Users ---
        console.log('\n👥 Step 1: Creating Users...');

        const actors = ['coord', 'fac_a', 'fac_b', 'fac_c'];
        for (let i = 1; i <= 9; i++) actors.push(`stu_${i}`);

        for (const key of actors) {
            const u = USERS[key];
            // Admin creates users (using Admin session)
            // Use /api/admin/users endpoint for cleaner creation than public register
            // Wait, does e2e_verify use public register? Yes.
            // Does /api/admin/users exist? Yes, I saw it in server/auth.ts (lines 174).
            // Let's use /api/admin/users to be "Admin-like" and bypass CAPTCHAs etc if any.

            const payload = { ...u };
            const createRes = await request('POST', '/api/admin/users', payload, 'admin');

            if (createRes.status === 201) {
                console.log(`   Created ${u.username}`);
            } else {
                console.error(`   Failed to create ${u.username}:`, createRes.data);
            }
        }

        // Login everyone to get cookies (needed for subsequent actions)
        console.log('   Authentication checks...');
        for (const key of actors) {
            const u = USERS[key];
            const lRes = await request('POST', '/auth/login', { username: u.username, password: u.password }, key);
            if (lRes.status !== 200) console.error(`   Failed to login ${key}`);
        }
        // Login Admin too (refresh cookie)
        await request('POST', '/auth/login', { username: 'admin', password: PASSWORDS.ADMIN }, 'admin');


        // --- Step 2: Submit Topics ---
        console.log('\n📝 Step 2: Submitting Topics...');

        const topicIds: Record<string, number> = {};

        for (const [key, t] of Object.entries(TOPICS)) {
            const res = await request('POST', '/api/topics', t, t.owner);
            if (res.status === 201) {
                topicIds[key] = res.data.id;
                console.log(`   Submitted ${t.title}`);
            } else {
                console.error(`   Failed to submit ${t.title}:`, res.data);
            }
        }

        // --- Step 3: Approvals ---
        console.log('\n✅ Step 3: Coordinator Approvals...');
        // Approve A
        await request('POST', `/api/topics/${topicIds.A}/approve`, { feedback: 'Approved' }, 'coord');
        // Approve B
        await request('POST', `/api/topics/${topicIds.B}/approve`, { feedback: 'Approved' }, 'coord');
        // Reject C
        await request('POST', `/api/topics/${topicIds.C}/reject`, { feedback: 'Too simple' }, 'coord');
        console.log('   Topics A & B Approved, C Rejected.');


        // --- Step 4: Group Formation ---
        console.log('\n🤝 Step 4: Forming Groups...');

        async function createGroup(leaderKey: string, memberKeys: string[], name: string) {
            // Need a faculty ID. Let's use Fac A.
            // Fetch Fac A profile to get ID
            const pRes = await request('GET', '/api/profile', null, 'fac_a');
            const facId = pRes.data.id;

            const payload = {
                name,
                description: `Group ${name}`,
                facultyId: facId,
                enrollmentNumbers: memberKeys.map(k => USERS[k].enrollmentNumber)
            };

            const gRes = await request('POST', '/api/student-groups', payload, leaderKey);
            if (gRes.status !== 201) {
                console.error(`   Failed to create ${name}:`, gRes.data);
                return null;
            }
            const groupId = gRes.data.id;

            // Invites
            for (const mKey of memberKeys) {
                await request('POST', `/api/groups/invite/${groupId}/accept`, {}, mKey);
            }
            console.log(`   Formed ${name} (Leader: ${USERS[leaderKey].enrollmentNumber})`);
            return groupId;
        }

        // Alpha: E001 (Leader), E002, E003
        await createGroup('stu_1', ['stu_2', 'stu_3'], 'Group Alpha');

        // Beta: E004 (Leader), E005, E006
        await createGroup('stu_4', ['stu_5', 'stu_6'], 'Group Beta');

        // Gamma: E007 (Leader), E008, E009
        await createGroup('stu_7', ['stu_8', 'stu_9'], 'Group Gamma');


        // --- Step 5: Allocations ---
        console.log('\n🎯 Step 5: Allocating Topics...');

        // Alpha selects Topic A
        let selRes = await request('POST', '/api/projects', { topicId: topicIds.A }, 'stu_1');
        if (selRes.status === 201) console.log('   Alpha selected Topic A');
        else console.error('   Alpha selection failed:', selRes.data);

        // Beta selects Topic B
        selRes = await request('POST', '/api/projects', { topicId: topicIds.B }, 'stu_4');
        if (selRes.status === 201) console.log('   Beta selected Topic B');
        else console.error('   Beta selection failed:', selRes.data);

        // Gamma selects nothing (Unallocated)


        // --- Step 6: Generate Output ---
        console.log('\n📄 Step 6: Generating AccDet.txt...');

        const content = `=== SYSTEM ACCOUNTS ===
Admin: ${USERS.admin.username} | ${PASSWORDS.ADMIN}
Coordinator: ${USERS.coord.username} | ${PASSWORDS.COORD}

=== FACULTY ===
Faculty A: ${USERS.fac_a.username} | ${PASSWORDS.DEFAULT} | Topic: A (Approved)
Faculty B: ${USERS.fac_b.username} | ${PASSWORDS.DEFAULT} | Topic: B (Approved)
Faculty C: ${USERS.fac_c.username} | ${PASSWORDS.DEFAULT} | Topic: C (REJECTED)

=== STUDENT GROUPS ===
[Group Alpha] - Leader: ${USERS.stu_1.username} (${PASSWORDS.DEFAULT}) | Members: ${USERS.stu_2.username}, ${USERS.stu_3.username} | Topic: A
[Group Beta]  - Leader: ${USERS.stu_4.username} (${PASSWORDS.DEFAULT}) | Members: ${USERS.stu_5.username}, ${USERS.stu_6.username} | Topic: B
[Group Gamma] - Leader: ${USERS.stu_7.username} (${PASSWORDS.DEFAULT}) | Members: ${USERS.stu_8.username}, ${USERS.stu_9.username} | Topic: NONE (Pending)
`;

        await fs.writeFile('AccDet.txt', content);
        console.log('✨ Seed Complete! Valid credentials saved to AccDet.txt');

    } catch (e: any) {
        console.error('Seed Script Failed:', e);
        process.exit(1);
    }
}

runSeed();
