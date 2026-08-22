import 'dotenv/config';
import { strict as assert } from 'assert';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;
const COOKIE_JAR: Record<string, string> = {};

async function request(method: string, path: string, body?: any, asUser?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (asUser && COOKIE_JAR[asUser]) headers['Cookie'] = COOKIE_JAR[asUser];

    const response = await fetch(`${BASE_URL}${path}`, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie && asUser) COOKIE_JAR[asUser] = setCookie.split(',').map((c: string) => c.split(';')[0]).join('; ');

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) data = await response.json();
    else data = await response.text();

    return { status: response.status, data };
}

const PASSWORDS = { ADMIN: 'Admin@123', COORD: 'Coord@123', DEFAULT: 'Pass@123' };

const USERS: Record<string, any> = {
    admin: { username: 'admin', password: PASSWORDS.ADMIN, role: 'admin', firstName: 'System', lastName: 'Admin', email: 'admin_email' },
    coord: { username: 'coordinator', password: PASSWORDS.COORD, role: 'coordinator', firstName: 'Project', lastName: 'Coordinator', email: 'coord_email', course: 'BCA', enrollmentNumber: 'COORD01' },
    fac_a: { username: 'faculty_a', password: PASSWORDS.DEFAULT, role: 'supervisor', firstName: 'Faculty', lastName: 'A', email: 'fac_a@test.com', course: 'BCA', enrollmentNumber: 'FACA' },
    fac_b: { username: 'faculty_b', password: PASSWORDS.DEFAULT, role: 'supervisor', firstName: 'Faculty', lastName: 'B', email: 'fac_b@test.com', course: 'BCA', enrollmentNumber: 'FACB' },
    fac_c: { username: 'faculty_c', password: PASSWORDS.DEFAULT, role: 'supervisor', firstName: 'Faculty', lastName: 'C', email: 'fac_c@test.com', course: 'MCA', enrollmentNumber: 'FACC' },
    fac_d: { username: 'faculty_d', password: PASSWORDS.DEFAULT, role: 'supervisor', firstName: 'Faculty', lastName: 'D', email: 'fac_d@test.com', course: 'MCA', enrollmentNumber: 'FACD' },
};

// 6 BCA Students (1-6)
for (let i = 1; i <= 6; i++) {
    USERS[`stu_${i}`] = { username: `student_${i}`, password: PASSWORDS.DEFAULT, role: 'student', firstName: 'Student', lastName: `${i}`, email: `student${i}@test.com`, course: 'BCA', enrollmentNumber: `E00${i}` };
}
// 6 MCA Students (7-12)
for (let i = 7; i <= 12; i++) {
    USERS[`stu_${i}`] = { username: `student_${i}`, password: PASSWORDS.DEFAULT, role: 'student', firstName: 'Student', lastName: `${i}`, email: `student${i}@test.com`, course: 'MCA', enrollmentNumber: `E00${i}` };
}

const TOPICS: Record<string, any> = {
    A: { title: 'Topic A (BCA)', description: 'Desc A', technology: 'React', projectType: 'Research', course: 'BCA', owner: 'fac_a' },
    B: { title: 'Topic B (BCA)', description: 'Desc B', technology: 'Node', projectType: 'Development', course: 'BCA', owner: 'fac_b' },
    C: { title: 'Topic C (BCA)', description: 'Desc C', technology: 'Python', projectType: 'Mini Project', course: 'BCA', owner: 'fac_b' },
    I: { title: 'Topic I (BCA Unallocated)', description: 'Desc I', technology: 'Vue', projectType: 'Mini Project', course: 'BCA', owner: 'fac_a' },
    
    D: { title: 'Topic D (MCA)', description: 'Desc D', technology: 'Java', projectType: 'Major Project', course: 'MCA', owner: 'fac_c' },
    E: { title: 'Topic E (MCA)', description: 'Desc E', technology: 'C++', projectType: 'Research', course: 'MCA', owner: 'fac_d' },
    F: { title: 'Topic F (MCA)', description: 'Desc F', technology: 'Go', projectType: 'Development', course: 'MCA', owner: 'fac_c' },
    G: { title: 'Topic G (MCA)', description: 'Desc G', technology: 'Rust', projectType: 'Development', course: 'MCA', owner: 'fac_d' },
    J: { title: 'Topic J (MCA Unallocated)', description: 'Desc J', technology: 'Ruby', projectType: 'Development', course: 'MCA', owner: 'fac_c' },
    
    H: { title: 'Topic H (MCA Reject)', description: 'Desc H', technology: 'Rust', projectType: 'Development', course: 'MCA', owner: 'fac_d' }, // For rejection
};


async function runTest() {
    console.log('🚀 Starting End-to-End Flow Validation...');
    try {
        console.log('\n🧹 Step 0: Cleaning Database...');
        let res = await request('POST', '/auth/login', { username: 'admin', password: PASSWORDS.ADMIN }, 'admin');
        if (res.status === 200) await request('POST', '/api/admin/reset', { password: PASSWORDS.ADMIN }, 'admin');
        
        console.log('\n👤 Step 1: Setting up Actors...');
        res = await request('POST', '/auth/login', { username: 'admin', password: PASSWORDS.ADMIN }, 'admin');
        if (res.status !== 200) throw new Error('Failed to login as default admin');

        for (const [key, user] of Object.entries(USERS)) {
            if (key === 'admin') continue;
            const regRes = await request('POST', '/api/admin/users', user, 'admin');
            const lRes = await request('POST', '/auth/login', { username: user.username, password: user.password }, key);
            assert.equal(lRes.status, 200);
        }

        console.log('\n📝 Step 2: Submitting Topics...');
        const topicIds: Record<string, number> = {};
        for (const [key, t] of Object.entries(TOPICS)) {
            const r = await request('POST', '/api/topics', t, t.owner);
            assert.equal(r.status, 201);
            topicIds[key] = r.data.id;
        }

        console.log('\n👮 Step 3: Coordinator Approvals...');
        for (const [key, t] of Object.entries(TOPICS)) {
            if (key === 'H') {
                await request('POST', `/api/topics/${topicIds[key]}/reject`, { feedback: 'Too simple' }, 'coord');
            } else {
                await request('POST', `/api/topics/${topicIds[key]}/approve`, { feedback: 'Approved' }, 'coord');
            }
        }

        console.log('\n👥 Step 4: Forming Groups...');
        async function createGroup(leaderKey: string, memberKeys: string[], name: string, facKey: string) {
            const pRes = await request('GET', '/api/profile', null, facKey);
            const facId = pRes.data.id;
            const payload = { name, description: `Group ${name}`, supervisorId: facId, enrollmentNumbers: memberKeys.map(k => USERS[k].enrollmentNumber) };
            const gRes = await request('POST', '/api/student-groups', payload, leaderKey);
            assert.equal(gRes.status, 201);
            for (const mKey of memberKeys) await request('POST', `/api/groups/invite/${gRes.data.id}/accept`, {}, mKey);
            return gRes.data.id;
        }

        await createGroup('stu_1', ['stu_2'], 'BCA Alpha', 'fac_a');
        await createGroup('stu_3', ['stu_4'], 'BCA Beta', 'fac_b');
        await createGroup('stu_5', ['stu_6'], 'BCA Gamma', 'fac_a');

        await createGroup('stu_9', ['stu_10'], 'MCA Delta', 'fac_c');
        await createGroup('stu_11', ['stu_12'], 'MCA Epsilon', 'fac_d');

        console.log('\n🎯 Step 5: Allocating Topics...');
        async function selectTopic(stuKey: string, topicKey: string, expectedStatus: number) {
            const r = await request('POST', '/api/projects', { topicId: topicIds[topicKey] }, stuKey);
            assert.equal(r.status, expectedStatus, `Expected ${expectedStatus} for ${stuKey} -> ${topicKey}`);
        }

        // BCA
        await selectTopic('stu_1', 'A', 201);
        await selectTopic('stu_3', 'B', 201);
        await selectTopic('stu_5', 'C', 201);
        
        // Block double select
        await selectTopic('stu_5', 'A', 400); // Already taken by BCA Alpha

        // MCA Independent
        await selectTopic('stu_7', 'D', 201);
        await selectTopic('stu_8', 'E', 201);

        // MCA Groups
        await selectTopic('stu_9', 'F', 201);
        await selectTopic('stu_11', 'G', 201);

        // Cross-course selection block check
        // stu_7 tries to select BCA Topic C
        await selectTopic('stu_7', 'C', 400); 

        // Reject topic block check
        await selectTopic('stu_8', 'H', 400); 

        console.log('\n🔄 Step 6: System Reset...');
        res = await request('POST', '/api/admin/reset', { password: PASSWORDS.ADMIN }, 'admin');
        assert.equal(res.status, 200);

        console.log('\n✨ E2E Flow Test Completed Successfully!');
    } catch (err: any) {
        console.error('\n❌ TEST FAILED:', err.message);
        if (err.response) console.error(err.response);
        process.exit(1);
    }
}
runTest();
