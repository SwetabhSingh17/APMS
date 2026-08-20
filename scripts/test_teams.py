import requests
import string
import random

BASE_URL = "http://localhost:5000"

def rand_str(length=6):
    return ''.join(random.choices(string.ascii_letters, k=length))

def register(role, course, enrollment_number=None):
    if not enrollment_number:
        enrollment_number = rand_str(10)
    
    session = requests.Session()
    data = {
        "firstName": "Test",
        "lastName": rand_str(4),
        "email": f"{rand_str(6)}@example.com",
        "enrollmentNumber": enrollment_number,
        "password": "password123",
        "role": role,
        "department": "IT",
        "course": course
    }
    resp = session.post(f"{BASE_URL}/api/register", json=data)
    assert resp.status_code in [200, 201], f"Register failed: {resp.text}"
    return session, resp.json()

def test():
    print("Setting up users...")
    admin_session, admin_user = register("ADMIN", "BCA")
    sup_session, sup_user = register("SUPERVISOR", "BCA")
    
    bca1_session, bca1 = register("STUDENT", "BCA")
    bca2_session, bca2 = register("STUDENT", "BCA")
    bca3_session, bca3 = register("STUDENT", "BCA")
    
    mca1_session, mca1 = register("STUDENT", "MCA")
    mca2_session, mca2 = register("STUDENT", "MCA")
    mca3_session, mca3 = register("STUDENT", "MCA")

    print("\n--- Testing Student Team Creation ---")
    
    # MCA Student creates team (size 1) - should pass
    resp = mca1_session.post(f"{BASE_URL}/api/student-groups", json={
        "name": "MCA Solo",
        "description": "Solo project",
        "supervisorId": sup_user["id"],
        "enrollmentNumbers": [mca1["enrollmentNumber"]]
    })
    assert resp.status_code == 200, f"MCA size 1 failed: {resp.text}"
    print("✅ MCA size 1 passed")

    # MCA Student creates team (size 3) - should fail
    resp = mca2_session.post(f"{BASE_URL}/api/student-groups", json={
        "name": "MCA Large",
        "description": "Large project",
        "supervisorId": sup_user["id"],
        "enrollmentNumbers": [mca2["enrollmentNumber"], mca3["enrollmentNumber"], mca1["enrollmentNumber"]]
    })
    assert resp.status_code == 400, f"MCA size > 2 should fail but didn't: {resp.text}"
    print("✅ MCA size > 2 rejected")

    # BCA Student creates team (size 1) - should fail
    resp = bca1_session.post(f"{BASE_URL}/api/student-groups", json={
        "name": "BCA Solo",
        "description": "Solo project",
        "supervisorId": sup_user["id"],
        "enrollmentNumbers": [bca1["enrollmentNumber"]]
    })
    assert resp.status_code == 400, f"BCA size 1 should fail but didn't: {resp.text}"
    print("✅ BCA size 1 rejected")

    # BCA Student creates team (size 2) - should pass
    resp = bca1_session.post(f"{BASE_URL}/api/student-groups", json={
        "name": "BCA Duo",
        "description": "Duo project",
        "supervisorId": sup_user["id"],
        "enrollmentNumbers": [bca1["enrollmentNumber"], bca2["enrollmentNumber"]]
    })
    assert resp.status_code == 200, f"BCA size 2 failed: {resp.text}"
    print("✅ BCA size 2 passed")
    bca_group = resp.json()

    # Mix courses - should fail
    bca4_session, bca4 = register("STUDENT", "BCA")
    resp = bca4_session.post(f"{BASE_URL}/api/student-groups", json={
        "name": "Mixed",
        "description": "Mixed project",
        "supervisorId": sup_user["id"],
        "enrollmentNumbers": [bca4["enrollmentNumber"], mca2["enrollmentNumber"]]
    })
    assert resp.status_code == 400, f"Mixed courses should fail but didn't: {resp.text}"
    print("✅ Mixed courses rejected")

    print("\n--- Testing Admin/Coordinator Capabilities ---")
    
    # Admin creates BCA team of 1 - should pass
    bca5_session, bca5 = register("STUDENT", "BCA")
    resp = admin_session.post(f"{BASE_URL}/api/student-groups", json={
        "name": "Admin BCA Solo",
        "description": "Admin created",
        "supervisorId": sup_user["id"],
        "enrollmentNumbers": [bca5["enrollmentNumber"]]
    })
    assert resp.status_code == 200, f"Admin BCA size 1 failed: {resp.text}"
    print("✅ Admin BCA size 1 passed")

    # Admin edits team members (add member)
    bca6_session, bca6 = register("STUDENT", "BCA")
    resp = admin_session.patch(f"{BASE_URL}/api/student-groups/{bca_group['id']}/members", json={
        "enrollmentNumbers": [bca1["enrollmentNumber"], bca2["enrollmentNumber"], bca6["enrollmentNumber"]]
    })
    assert resp.status_code == 200, f"Admin patch members failed: {resp.text}"
    print("✅ Admin editing members passed")

    # Student tries to edit members (should fail)
    resp = bca1_session.patch(f"{BASE_URL}/api/student-groups/{bca_group['id']}/members", json={
        "enrollmentNumbers": [bca1["enrollmentNumber"], bca6["enrollmentNumber"]]
    })
    assert resp.status_code in [401, 403], f"Student patch members should fail: {resp.text}"
    print("✅ Student editing members rejected")

    print("\n🎉 All tests passed successfully!")

if __name__ == "__main__":
    test()
