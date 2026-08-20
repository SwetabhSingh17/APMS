

const BASE_URL = "http://localhost:3000";

const randStr = (length = 6) => {
    let result = '';
    const characters = 'abcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

async function register(role, course, enrollmentNumber = null) {
    if (!enrollmentNumber) {
        enrollmentNumber = randStr(10);
    }
    
    const data = {
        username: enrollmentNumber,
        firstName: "Test",
        lastName: randStr(4),
        email: `${randStr(6)}@example.com`,
        enrollmentNumber,
        password: "password123",
        role,
        department: "IT",
        course
    };
    
    const resp = await fetch(`${BASE_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Register failed: ${text}`);
    }
    
    const cookie = resp.headers.get('set-cookie');
    const user = await resp.json();
    return { cookie, user };
}

async function request(method, path, session, data = null) {
    const options = {
        method,
        headers: {
            "Content-Type": "application/json",
            "Cookie": session.cookie || ""
        },
    };
    if (data) {
        options.body = JSON.stringify(data);
    }
    const resp = await fetch(`${BASE_URL}${path}`, options);
    const text = await resp.text();
    return { status: resp.status, data: text };
}

async function runTest() {
    try {
        console.log("Setting up users...");
        const admin = await register("coordinator", "BCA");
        const sup = await register("supervisor", "BCA");
        
        const bca1 = await register("student", "BCA");
        const bca2 = await register("student", "BCA");
        const bca3 = await register("student", "BCA");
        
        const mca1 = await register("student", "MCA");
        const mca2 = await register("student", "MCA");
        const mca3 = await register("student", "MCA");

        console.log("\n--- Testing Student Team Creation ---");
        
        let resp = await request("POST", "/api/student-groups", mca1, {
            name: "MCA Solo",
            description: "Solo project",
            supervisorId: sup.user.id,
            enrollmentNumbers: []
        });
        if (resp.status !== 200 && resp.status !== 201) throw new Error(`MCA size 1 failed: ${resp.data}`);
        console.log("✅ MCA size 1 passed");

        resp = await request("POST", "/api/student-groups", mca2, {
            name: "MCA Large",
            description: "Large project",
            supervisorId: sup.user.id,
            enrollmentNumbers: [mca3.user.enrollmentNumber, mca1.user.enrollmentNumber]
        });
        if (resp.status === 200 || resp.status === 201) throw new Error(`MCA size > 2 should fail but didn't: ${resp.data}`);
        console.log("✅ MCA size > 2 rejected");

        resp = await request("POST", "/api/student-groups", bca1, {
            name: "BCA Solo",
            description: "Solo project",
            supervisorId: sup.user.id,
            enrollmentNumbers: []
        });
        if (resp.status === 200 || resp.status === 201) throw new Error(`BCA size 1 should fail but didn't: ${resp.data}`);
        console.log("✅ BCA size 1 rejected");

        resp = await request("POST", "/api/student-groups", bca1, {
            name: "BCA Duo",
            description: "Duo project",
            supervisorId: sup.user.id,
            enrollmentNumbers: [bca2.user.enrollmentNumber]
        });
        if (resp.status !== 200 && resp.status !== 201) throw new Error(`BCA size 2 failed: ${resp.data}`);
        console.log("✅ BCA size 2 passed");
        const bcaGroup = JSON.parse(resp.data);

        const bca4 = await register("student", "BCA");
        resp = await request("POST", "/api/student-groups", bca4, {
            name: "Mixed",
            description: "Mixed project",
            supervisorId: sup.user.id,
            enrollmentNumbers: [bca4.user.enrollmentNumber, mca2.user.enrollmentNumber]
        });
        if (resp.status === 200 || resp.status === 201) throw new Error(`Mixed courses should fail but didn't: ${resp.data}`);
        console.log("✅ Mixed courses rejected");

        console.log("\n--- Testing Admin/Coordinator Capabilities ---");
        
        const bca5 = await register("student", "BCA");
        resp = await request("POST", "/api/student-groups", admin, {
            name: "Admin BCA Solo",
            description: "Admin created",
            supervisorId: sup.user.id,
            enrollmentNumbers: [bca5.user.enrollmentNumber]
        });
        if (resp.status !== 200 && resp.status !== 201) throw new Error(`Admin BCA size 1 failed: ${resp.data}`);
        console.log("✅ Admin BCA size 1 passed");

        const bca6 = await register("student", "BCA");
        resp = await request("PATCH", `/api/student-groups/${bcaGroup.id}/members`, admin, {
            enrollmentNumbers: [bca1.user.enrollmentNumber, bca2.user.enrollmentNumber, bca6.user.enrollmentNumber]
        });
        if (resp.status !== 200) throw new Error(`Admin patch members failed: ${resp.data}`);
        console.log("✅ Admin editing members passed");

        resp = await request("PATCH", `/api/student-groups/${bcaGroup.id}/members`, bca1, {
            enrollmentNumbers: [bca1.user.enrollmentNumber, bca6.user.enrollmentNumber]
        });
        if (resp.status !== 401 && resp.status !== 403) throw new Error(`Student patch members should fail: ${resp.data}`);
        console.log("✅ Student editing members rejected");

        console.log("\n🎉 All tests passed successfully!");
    } catch (e) {
        console.error("Test failed:");
        console.error(e);
        process.exit(1);
    }
}

runTest();
