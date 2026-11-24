import os
import requests
import sys

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

def run_tests():
    print("=" * 60)
    print("VMS - User Single Screen Verification Test Suite")
    print("=" * 60)

    # 1. Login as Super Admin to inspect system state
    print("\n[1] Testing Super Admin authentication...")
    admin_login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username_or_email": "admin",
        "password": "Admin@12345"
    })
    if admin_login_resp.status_code != 200:
        admin_login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username_or_email": "admin@example.com",
            "password": "Admin@12345"
        })

    assert admin_login_resp.status_code == 200, f"Super Admin login failed: {admin_login_resp.text}"
    admin_token = admin_login_resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("✓ Super Admin login successful.")

    # 2. Get a sample voter record with a unique_key
    print("\n[2] Fetching sample voter record with 5-character unique_key...")
    voters_resp = requests.get(f"{BASE_URL}/api/voter-records?limit=5", headers=admin_headers)
    assert voters_resp.status_code == 200, f"Failed to fetch voters: {voters_resp.text}"
    voters_data = voters_resp.json()
    voters = voters_data.get("records", []) if isinstance(voters_data, dict) else voters_data
    assert len(voters) > 0, "No voter records found in database!"

    sample_voter = None
    for v in voters:
        if v.get("unique_key") and len(v["unique_key"]) == 5:
            sample_voter = v
            break

    assert sample_voter is not None, "No voter record with 5-character unique_key found!"
    target_code = sample_voter["unique_key"]
    print(f"✓ Found sample voter: ID={sample_voter['id']}, Name='{sample_voter.get('voter_name')}', Unique Code='{target_code}'")

    # 3. Create or login as standard Field User
    print("\n[3] Authenticating as standard Field User...")
    user_login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username_or_email": "fielduser",
        "password": "userpassword123"
    })
    
    if user_login_resp.status_code != 200:
        # Create standard user if not exists
        print("Creating standard test user 'fielduser'...")
        create_user_resp = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=admin_headers,
            json={
                "username": "fielduser",
                "email": "fielduser@example.com",
                "full_name": "Field Verification User",
                "role": "user",
                "password": "userpassword123",
                "is_active": True
            }
        )
        if create_user_resp.status_code in (200, 201):
            print("✓ User 'fielduser' created successfully.")
        else:
            print(f"User creation response ({create_user_resp.status_code}): {create_user_resp.text}")

        user_login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username_or_email": "fielduser",
            "password": "userpassword123"
        })

    assert user_login_resp.status_code == 200, f"User login failed: {user_login_resp.text}"
    user_data = user_login_resp.json()
    fielduser_id = user_data.get("user", {}).get("id")
    user_token = user_data["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    print(f"✓ User logged in successfully (ID={fielduser_id}). Role: {user_data.get('user', {}).get('role')}")

    # Assign geographic scope to fielduser matching sample voter's document
    print("Assigning geographic scope to 'fielduser'...")
    doc_constituency = sample_voter.get("constituency") or "తాడేపల్లిగూడెం (Tadepalligudem)"
    doc_district = "పశ్చిమ గోదావరి (West Godavari)"
    assign_resp = requests.post(
        f"{BASE_URL}/api/admin/user-assignments",
        headers=admin_headers,
        json={
            "user_id": fielduser_id,
            "district": doc_district,
            "constituency": doc_constituency,
            "wards": ["ALL"],
            "status": "ACTIVE"
        }
    )
    if assign_resp.status_code in (200, 201):
        print(f"✓ Assigned {doc_constituency} (ALL wards) to fielduser.")
    else:
        print(f"Assignment note ({assign_resp.status_code}): {assign_resp.text}")

    # 4. Verify voter with valid 5-character code
    print(f"\n[4] User verifies valid 5-character code '{target_code}'...")
    verify_resp = requests.get(f"{BASE_URL}/api/voters/verify/{target_code}", headers=user_headers)
    assert verify_resp.status_code == 200, f"Verification failed: {verify_resp.text}"
    verify_data = verify_resp.json()

    print(f"✓ Verification returned 200 OK.")
    print(f"  Voter Name: {verify_data.get('voter_name')}")
    print(f"  EPIC Number: {verify_data.get('epic_number')}")
    print(f"  Relation Name: {verify_data.get('relation_name') or verify_data.get('father_or_husband_name')}")
    print(f"  Age: {verify_data.get('age')}, Gender: {verify_data.get('gender')}")
    print(f"  House No: {verify_data.get('house_no') or verify_data.get('house_number')}")
    print(f"  Constituency: {verify_data.get('constituency')}, Ward: {verify_data.get('ward')}")
    print(f"  Unique Code: {verify_data.get('unique_code')}")
    assert verify_data.get("unique_code") == target_code, "Unique code mismatch!"

    # 5. Case-insensitivity test (lowercase submission converted on backend)
    print(f"\n[5] Testing case-insensitivity with lowercase '{target_code.lower()}'...")
    lower_resp = requests.get(f"{BASE_URL}/api/voters/verify/{target_code.lower()}", headers=user_headers)
    assert lower_resp.status_code == 200, f"Lowercase verification failed: {lower_resp.text}"
    assert lower_resp.json()["unique_code"] == target_code
    print("✓ Backend successfully normalizes lowercase codes to uppercase.")

    # 6. Verify non-existent code returns HTTP 404 "Invalid Voter Code"
    print("\n[6] User verifies non-existent code 'ZZ999'...")
    invalid_resp = requests.get(f"{BASE_URL}/api/voters/verify/ZZ999", headers=user_headers)
    assert invalid_resp.status_code == 404, f"Expected 404, got {invalid_resp.status_code}"
    error_detail = invalid_resp.json().get("detail", "")
    assert error_detail == "Invalid Voter Code", f"Unexpected error message: '{error_detail}'"
    print(f"✓ Non-existent code correctly returned HTTP 404 with detail: '{error_detail}'")

    # 7. Verify malformed codes (<5 or >5 characters)
    print("\n[7] User submits malformed codes...")
    short_resp = requests.get(f"{BASE_URL}/api/voters/verify/ABC", headers=user_headers)
    assert short_resp.status_code == 400, f"Expected 400 for short code, got {short_resp.status_code}"
    print("✓ Short code (3 chars) correctly rejected with HTTP 400.")

    long_resp = requests.get(f"{BASE_URL}/api/voters/verify/ABCDEF", headers=user_headers)
    assert long_resp.status_code == 400, f"Expected 400 for long code, got {long_resp.status_code}"
    print("✓ Long code (6 chars) correctly rejected with HTTP 400.")

    # 8. Security verification: User blocked from bulk voter endpoints
    print("\n[8] Security check: Verifying standard User is blocked from bulk voter endpoints...")
    bulk_records_resp = requests.get(f"{BASE_URL}/api/voter-records", headers=user_headers)
    assert bulk_records_resp.status_code == 403, f"Expected 403 for /api/voter-records, got {bulk_records_resp.status_code}"
    print("✓ User blocked from GET /api/voter-records (HTTP 403 Forbidden).")

    voters_list_resp = requests.get(f"{BASE_URL}/api/voters", headers=user_headers)
    assert voters_list_resp.status_code == 403, f"Expected 403 for /api/voters, got {voters_list_resp.status_code}"
    print("✓ User blocked from GET /api/voters (HTTP 403 Forbidden).")

    search_resp = requests.get(f"{BASE_URL}/api/voters/search?query=test", headers=user_headers)
    assert search_resp.status_code == 403, f"Expected 403 for /api/voters/search, got {search_resp.status_code}"
    print("✓ User blocked from GET /api/voters/search (HTTP 403 Forbidden).")

    pdf_resp = requests.post(f"{BASE_URL}/api/voters/pdf/generate", headers=user_headers, json={"part_number": 1})
    assert pdf_resp.status_code == 403, f"Expected 403 for /api/voters/pdf/generate, got {pdf_resp.status_code}"
    print("✓ User blocked from POST /api/voters/pdf/generate (HTTP 403 Forbidden).")

    # 9. Super Admin retaining full access to bulk records
    print("\n[9] Super Admin access retention check...")
    admin_bulk_resp = requests.get(f"{BASE_URL}/api/voter-records?limit=1", headers=admin_headers)
    assert admin_bulk_resp.status_code == 200, f"Admin bulk records failed: {admin_bulk_resp.status_code}"
    print("✓ Super Admin retains full access to GET /api/voter-records.")

    admin_verify_resp = requests.get(f"{BASE_URL}/api/voters/verify/{target_code}", headers=admin_headers)
    assert admin_verify_resp.status_code == 200, f"Admin verify failed: {admin_verify_resp.status_code}"
    print("✓ Super Admin can also verify voter codes.")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! (100% compliant)")
    print("=" * 60)

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}", file=sys.stderr)
        sys.exit(1)
