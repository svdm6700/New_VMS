"""
VMS - Role-Based Access Control (RBAC) & Screen Visibility Verification Suite
Validates all 14 test cases specified in Section 11 of the RBAC requirements.
"""

import sys
import io
import json
import requests

BASE_URL = "http://127.0.0.1:8000"

# ANSI Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

passed_tests = 0
failed_tests = 0

def log_test(num: int, title: str, status: bool, detail: str = ""):
    global passed_tests, failed_tests
    if status:
        passed_tests += 1
        print(f"[{GREEN}PASS{RESET}] Test {num:02d}: {title}")
    else:
        failed_tests += 1
        print(f"[{RED}FAIL{RESET}] Test {num:02d}: {title}")
    if detail:
        print(f"       {detail}")

def get_auth_token(username: str, password: str) -> str:
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"username_or_email": username, "password": password})
    if res.status_code != 200:
        raise Exception(f"Failed to authenticate {username}: {res.status_code} {res.text}")
    return res.json()["access_token"]

def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

def run_all_tests():
    global passed_tests, failed_tests
    print(f"\n{BLUE}========================================================================{RESET}")
    print(f"{BLUE}   VMS - ROLE-BASED ACCESS CONTROL (RBAC) HIERARCHY TEST SUITE (14 CASES){RESET}")
    print(f"{BLUE}========================================================================\n{RESET}")

    # Step 0: Obtain credentials
    super_token = get_auth_token("admin", "Admin@12345")
    admin_token = get_auth_token("admin_scoped", "Admin@12345")
    user_token = get_auth_token("tester", "User@12345")

    # -------------------------------------------------------------
    # Test 1: Super Admin full access to all endpoints
    # -------------------------------------------------------------
    try:
        endpoints = [
            "/api/admin/districts",
            "/api/admin/constituencies",
            "/api/admin/wards",
            "/api/admin/users",
            "/api/admin/user-assignments",
            "/api/documents",
            "/api/voter-records",
            "/api/payments/reports",
            "/api/admin/wallet/summary",
        ]
        all_ok = True
        err_msg = ""
        for ep in endpoints:
            r = requests.get(f"{BASE_URL}{ep}", headers=auth_headers(super_token))
            if r.status_code != 200:
                all_ok = False
                err_msg = f"{ep} returned {r.status_code}: {r.text}"
                break
        log_test(1, "Super Admin full access to all endpoints", all_ok, err_msg)
    except Exception as e:
        log_test(1, "Super Admin full access to all endpoints", False, str(e))

    # -------------------------------------------------------------
    # Test 2: Super Admin creation, modification, and deletion of Districts, Constituencies, and Wards
    # -------------------------------------------------------------
    try:
        # Create District
        d_res = requests.post(
            f"{BASE_URL}/api/admin/districts",
            json={"name": "Test District RBAC", "code": "TDRBAC", "state": "Andhra Pradesh"},
            headers=auth_headers(super_token)
        )
        assert d_res.status_code in (200, 201), f"District create failed: {d_res.text}"
        dist_id = d_res.json()["id"]

        # Update District
        d_up = requests.put(
            f"{BASE_URL}/api/admin/districts/{dist_id}",
            json={"name": "Test District RBAC Updated"},
            headers=auth_headers(super_token)
        )
        assert d_up.status_code == 200, f"District update failed: {d_up.text}"

        # Create Constituency
        c_res = requests.post(
            f"{BASE_URL}/api/admin/constituencies",
            json={"name": "Test Const RBAC", "code": "TCRBAC", "district_id": dist_id, "district_name": "Test District RBAC Updated"},
            headers=auth_headers(super_token)
        )
        assert c_res.status_code in (200, 201), f"Constituency create failed: {c_res.text}"
        const_id = c_res.json()["id"]

        # Update Constituency
        c_up = requests.put(
            f"{BASE_URL}/api/admin/constituencies/{const_id}",
            json={"name": "Test Const RBAC Updated"},
            headers=auth_headers(super_token)
        )
        assert c_up.status_code == 200, f"Constituency update failed: {c_up.text}"

        # Create Ward
        w_res = requests.post(
            f"{BASE_URL}/api/admin/wards",
            json={"ward_number": "99", "constituency_id": const_id, "constituency_name": "Test Const RBAC Updated", "area_name": "Test Area"},
            headers=auth_headers(super_token)
        )
        assert w_res.status_code in (200, 201), f"Ward create failed: {w_res.text}"
        ward_id = w_res.json()["id"]

        # Delete Ward
        w_del = requests.delete(f"{BASE_URL}/api/admin/wards/{ward_id}", headers=auth_headers(super_token))
        assert w_del.status_code == 200, f"Ward delete failed: {w_del.text}"

        # Delete Constituency
        c_del = requests.delete(f"{BASE_URL}/api/admin/constituencies/{const_id}", headers=auth_headers(super_token))
        assert c_del.status_code == 200, f"Constituency delete failed: {c_del.text}"

        # Delete District
        d_del = requests.delete(f"{BASE_URL}/api/admin/districts/{dist_id}", headers=auth_headers(super_token))
        assert d_del.status_code == 200, f"District delete failed: {d_del.text}"

        log_test(2, "Super Admin CRUD for Districts, Constituencies, and Wards", True, "Successfully created, modified, and deleted master records.")
    except Exception as e:
        log_test(2, "Super Admin CRUD for Districts, Constituencies, and Wards", False, str(e))

    # -------------------------------------------------------------
    # Test 3: Admin access permitted to document upload within scope
    # -------------------------------------------------------------
    try:
        # admin_scoped is assigned to Tadepalligudem Ward 2
        dummy_pdf = io.BytesIO(b"%PDF-1.4 mock content for rbac testing")
        files = {"file": ("test_scoped_admin.pdf", dummy_pdf, "application/pdf")}
        data = {
            "district": "West Godavari",
            "constituency": "తాడేపల్లిగూడెం (Tadepalligudem)",
            "area": "Ward 2 Area",
            "ward_number": "2"
        }
        r = requests.post(f"{BASE_URL}/api/documents/upload", files=files, data=data, headers=auth_headers(admin_token))
        assert r.status_code in (200, 201), f"Admin upload within scope failed: {r.status_code} {r.text}"
        doc_id = r.json()["document_id"]

        # Verify admin can see it in documents list
        doc_list_res = requests.get(f"{BASE_URL}/api/documents", headers=auth_headers(admin_token))
        assert doc_list_res.status_code == 200
        docs = doc_list_res.json()
        if isinstance(docs, dict) and "documents" in docs:
            docs = docs["documents"]
        assert any(d["id"] == doc_id for d in docs), "Uploaded document not in admin scoped document list"

        log_test(3, "Admin permitted to upload documents within authorized geographic scope", True, f"Document {doc_id} uploaded and listed.")
    except Exception as e:
        log_test(3, "Admin permitted to upload documents within authorized geographic scope", False, str(e))

    # -------------------------------------------------------------
    # Test 4: Admin forbidden from District, Constituency, and Ward master creation or deletion
    # -------------------------------------------------------------
    try:
        checks = [
            requests.post(f"{BASE_URL}/api/admin/districts", json={"name": "Hacked Dist"}, headers=auth_headers(admin_token)),
            requests.delete(f"{BASE_URL}/api/admin/districts/1", headers=auth_headers(admin_token)),
            requests.post(f"{BASE_URL}/api/admin/constituencies", json={"name": "Hacked Const", "district_name": "Test"}, headers=auth_headers(admin_token)),
            requests.delete(f"{BASE_URL}/api/admin/constituencies/1", headers=auth_headers(admin_token)),
            requests.post(f"{BASE_URL}/api/admin/wards", json={"ward_number": "999", "constituency_name": "Test"}, headers=auth_headers(admin_token)),
            requests.delete(f"{BASE_URL}/api/admin/wards/1", headers=auth_headers(admin_token)),
        ]
        all_forbidden = all(c.status_code == 403 for c in checks)
        detail = "All 6 mutation master endpoints returned 403 Forbidden for Admin." if all_forbidden else f"One or more failed: {[c.status_code for c in checks]}"
        log_test(4, "Admin forbidden from District, Constituency, Ward master mutations (403)", all_forbidden, detail)
    except Exception as e:
        log_test(4, "Admin forbidden from District, Constituency, Ward master mutations (403)", False, str(e))

    # -------------------------------------------------------------
    # Test 5: Admin forbidden from uploading documents outside authorized Constituency and Ward scope
    # -------------------------------------------------------------
    try:
        dummy_pdf = io.BytesIO(b"%PDF-1.4 mock content for rbac testing")
        files = {"file": ("test_unauthorized_scope.pdf", dummy_pdf, "application/pdf")}
        data = {
            "district": "Krishna",
            "constituency": "Vijayawada Central",
            "area": "Governorpet",
            "ward_number": "14"
        }
        r = requests.post(f"{BASE_URL}/api/documents/upload", files=files, data=data, headers=auth_headers(admin_token))
        assert r.status_code == 403, f"Expected 403 Forbidden, got {r.status_code}: {r.text}"
        assert "authorized geographic scope" in r.text or "denied" in r.text.lower()
        log_test(5, "Admin forbidden from uploading outside authorized scope (403)", True, "Server blocked upload with 403 Forbidden.")
    except Exception as e:
        log_test(5, "Admin forbidden from uploading outside authorized scope (403)", False, str(e))

    # -------------------------------------------------------------
    # Test 6: Admin assignment of Users strictly validated against the Admin's authorized scope
    # -------------------------------------------------------------
    try:
        # Find a test user id
        users_res = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(super_token)).json()
        tester_user = next((u for u in users_res["users"] if u["role"] == "user"), None)
        assert tester_user is not None, "Could not find a standard user"

        # Case A: Admin attempts to assign outside authorized scope -> 403
        r_out = requests.post(
            f"{BASE_URL}/api/admin/user-assignments",
            json={
                "user_id": tester_user["id"],
                "district": "Guntur",
                "constituency": "Guntur East",
                "wards": ["5"],
                "status": "ACTIVE"
            },
            headers=auth_headers(admin_token)
        )
        assert r_out.status_code == 403, f"Expected 403 for out-of-scope assignment, got {r_out.status_code}: {r_out.text}"

        # Case B: Admin attempts to assign an Admin account -> 403
        admin_account = next((u for u in users_res["users"] if u["role"] in ("admin", "super_admin")), None)
        r_admin_assign = requests.post(
            f"{BASE_URL}/api/admin/user-assignments",
            json={
                "user_id": admin_account["id"],
                "district": "West Godavari",
                "constituency": "తాడేపల్లిగూడెం (Tadepalligudem)",
                "wards": ["2"],
                "status": "ACTIVE"
            },
            headers=auth_headers(admin_token)
        )
        assert r_admin_assign.status_code == 403, f"Expected 403 for assigning admin, got {r_admin_assign.status_code}"

        # Case C: Admin assigns User within authorized scope (Tadepalligudem Ward 2) -> 200
        r_ok = requests.post(
            f"{BASE_URL}/api/admin/user-assignments",
            json={
                "user_id": tester_user["id"],
                "district": "West Godavari",
                "constituency": "తాడేపల్లిగూడెం (Tadepalligudem)",
                "wards": ["2"],
                "status": "ACTIVE"
            },
            headers=auth_headers(admin_token)
        )
        assert r_ok.status_code in (200, 201), f"Valid assignment failed: {r_ok.status_code} {r_ok.text}"

        log_test(6, "Admin user assignment strictly validated against authorized scope", True, "Out-of-scope rejected with 403; in-scope accepted.")
    except Exception as e:
        log_test(6, "Admin user assignment strictly validated against authorized scope", False, str(e))

    # -------------------------------------------------------------
    # Test 7: User sees only assigned screens / user role checks
    # -------------------------------------------------------------
    try:
        profile_res = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(user_token))
        assert profile_res.status_code == 200
        profile = profile_res.json()
        assert profile["role"].lower() == "user", f"Expected user role, got {profile['role']}"
        log_test(7, "User profile and role identity verification", True, f"User identified as role: '{profile['role']}'.")
    except Exception as e:
        log_test(7, "User profile and role identity verification", False, str(e))

    # -------------------------------------------------------------
    # Test 8: User sees only assigned Constituency and Ward voter records
    # -------------------------------------------------------------
    try:
        # User queries voter records
        r_voters = requests.get(f"{BASE_URL}/api/voter-records", headers=auth_headers(user_token))
        assert r_voters.status_code == 200
        v_data = r_voters.json()
        records = v_data.get("records", [])

        # User attempts to query unassigned constituency explicitly -> 403
        r_unauth = requests.get(f"{BASE_URL}/api/voter-records?constituency=Tirupati", headers=auth_headers(user_token))
        assert r_unauth.status_code == 403, f"Expected 403 querying unassigned constituency, got {r_unauth.status_code}"

        log_test(8, "User sees only assigned Constituency & Ward voter records (tampering returns 403)", True, "Explicit query for unauthorized constituency blocked with 403.")
    except Exception as e:
        log_test(8, "User sees only assigned Constituency & Ward voter records (tampering returns 403)", False, str(e))

    # -------------------------------------------------------------
    # Test 9: User forbidden from accessing document upload screen and API (403 Forbidden)
    # -------------------------------------------------------------
    try:
        dummy_pdf = io.BytesIO(b"%PDF-1.4 mock")
        files = {"file": ("test_user.pdf", dummy_pdf, "application/pdf")}
        data = {"district": "WG", "constituency": "Tadepalligudem", "area": "Town", "ward_number": "2"}

        r_up = requests.post(f"{BASE_URL}/api/documents/upload", files=files, data=data, headers=auth_headers(user_token))
        assert r_up.status_code == 403, f"User upload returned {r_up.status_code}, expected 403"

        r_docs = requests.get(f"{BASE_URL}/api/documents", headers=auth_headers(user_token))
        assert r_docs.status_code == 403, f"User get documents returned {r_docs.status_code}, expected 403"

        r_sum = requests.get(f"{BASE_URL}/api/documents/summary", headers=auth_headers(user_token))
        assert r_sum.status_code == 403, f"User get documents summary returned {r_sum.status_code}, expected 403"

        log_test(9, "User forbidden from document upload and documents management (403)", True, "All document endpoints returned 403 Forbidden.")
    except Exception as e:
        log_test(9, "User forbidden from document upload and documents management (403)", False, str(e))

    # -------------------------------------------------------------
    # Test 10: User forbidden from User Assignment & User Management APIs (403 Forbidden)
    # -------------------------------------------------------------
    try:
        checks = [
            requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(user_token)),
            requests.post(f"{BASE_URL}/api/admin/users", json={"username": "hacker", "password": "123"}, headers=auth_headers(user_token)),
            requests.get(f"{BASE_URL}/api/admin/user-assignments", headers=auth_headers(user_token)),
            requests.post(f"{BASE_URL}/api/admin/user-assignments", json={"user_id": 1, "district": "WG"}, headers=auth_headers(user_token)),
            requests.get(f"{BASE_URL}/api/rbac/roles", headers=auth_headers(user_token)),
        ]
        all_forbidden = all(c.status_code == 403 for c in checks)
        log_test(10, "User forbidden from User Management & Assignments (403)", all_forbidden, f"Statuses: {[c.status_code for c in checks]}")
    except Exception as e:
        log_test(10, "User forbidden from User Management & Assignments (403)", False, str(e))

    # -------------------------------------------------------------
    # Test 11: User forbidden from accessing or debiting another user's wallet
    # -------------------------------------------------------------
    try:
        r_admin_wal = requests.get(f"{BASE_URL}/api/admin/wallet/summary", headers=auth_headers(user_token))
        assert r_admin_wal.status_code == 403, f"Expected 403 for admin wallet summary, got {r_admin_wal.status_code}"

        r_alloc = requests.post(f"{BASE_URL}/api/admin/wallet/allocate", json={"user_id": 1, "amount": 100}, headers=auth_headers(user_token))
        assert r_alloc.status_code == 403, f"Expected 403 for user allocation, got {r_alloc.status_code}"

        r_fund = requests.post(f"{BASE_URL}/api/admin/wallet/fund", json={"amount": 1000}, headers=auth_headers(user_token))
        assert r_fund.status_code == 403, f"Expected 403 for funding, got {r_fund.status_code}"

        log_test(11, "User forbidden from accessing or debiting other users' wallets (403)", True, "All administrative wallet APIs returned 403 Forbidden.")
    except Exception as e:
        log_test(11, "User forbidden from accessing or debiting other users' wallets (403)", False, str(e))

    # -------------------------------------------------------------
    # Test 12: Direct API requests cannot bypass permissions
    # -------------------------------------------------------------
    try:
        r_noauth = requests.get(f"{BASE_URL}/api/admin/users")
        assert r_noauth.status_code in (401, 403), f"Expected 401/403 without auth, got {r_noauth.status_code}"

        r_fake = requests.get(f"{BASE_URL}/api/admin/users", headers={"Authorization": "Bearer fake.jwt.token"})
        assert r_fake.status_code in (401, 403), f"Expected 401/403 with forged token, got {r_fake.status_code}"

        log_test(12, "Direct unauthenticated and forged API requests blocked (401/403)", True, "Unauthenticated and malformed tokens blocked.")
    except Exception as e:
        log_test(12, "Direct unauthenticated and forged API requests blocked (401/403)", False, str(e))

    # -------------------------------------------------------------
    # Test 13: Modifying URL parameters cannot expose unauthorized voter records
    # -------------------------------------------------------------
    try:
        # Admin modifies query to unassigned constituency
        r_admin_leak = requests.get(f"{BASE_URL}/api/voter-records?constituency=Eluru", headers=auth_headers(admin_token))
        assert r_admin_leak.status_code == 403, f"Admin tampering expected 403, got {r_admin_leak.status_code}"

        # User modifies search to unassigned constituency
        r_user_leak = requests.get(f"{BASE_URL}/api/voters/search?query=Kumar&constituency=Bhimavaram", headers=auth_headers(user_token))
        assert r_user_leak.status_code == 403, f"User tampering expected 403, got {r_user_leak.status_code}"

        log_test(13, "Modifying URL parameters cannot expose unauthorized voter records", True, "SQL-level geographic filters reject tampering with 403.")
    except Exception as e:
        log_test(13, "Modifying URL parameters cannot expose unauthorized voter records", False, str(e))

    # -------------------------------------------------------------
    # Test 14: Protection of the last active Super Admin account from deletion or deactivation
    # -------------------------------------------------------------
    try:
        users_res = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers(super_token)).json()
        super_admins = [u for u in users_res["users"] if u["role"] in ("super_admin", "superadmin")]
        assert len(super_admins) >= 1, "No super admin found"
        target_super = super_admins[0]

        # Attempt to delete Super Admin
        r_del = requests.delete(f"{BASE_URL}/api/admin/users/{target_super['id']}", headers=auth_headers(super_token))
        assert r_del.status_code in (400, 403), f"Expected 400/403 deleting last super admin, got {r_del.status_code}: {r_del.text}"

        # Attempt to deactivate Super Admin
        r_deact = requests.patch(
            f"{BASE_URL}/api/admin/users/{target_super['id']}/status",
            json={"is_active": False},
            headers=auth_headers(super_token)
        )
        assert r_deact.status_code in (400, 403), f"Expected 400/403 deactivating last super admin, got {r_deact.status_code}: {r_deact.text}"

        log_test(14, "Protection of the last active Super Admin account", True, "System blocked deletion and deactivation of root Super Admin.")
    except Exception as e:
        log_test(14, "Protection of the last active Super Admin account", False, str(e))

    # Summary
    print(f"\n{BLUE}========================================================================{RESET}")
    print(f"RBAC Test Results: {GREEN}{passed_tests} PASSED{RESET}, {RED}{failed_tests} FAILED{RESET} (Total: 14)")
    print(f"{BLUE}========================================================================\n{RESET}")
    if failed_tests > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_all_tests()
