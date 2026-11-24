import os
import sys
import uuid
import requests
from decimal import Decimal

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

def log(msg):
    print(f"[TEST] {msg}")

def login(username, password):
    res = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username_or_email": username, "password": password}
    )
    if res.status_code != 200:
        raise Exception(f"Login failed for {username}: {res.status_code} {res.text}")
    return res.json()["access_token"]

def get_or_create_user(admin_headers, username, email, full_name, role="USER", password="User@12345"):
    user_res = requests.get(f"{BASE_URL}/api/admin/users?query={username}&limit=100", headers=admin_headers)
    all_users = user_res.json().get("users", [])
    matching = [u for u in all_users if u["username"] == username or u.get("email") == email]
    if matching:
        return matching[0]["id"]
    create_res = requests.post(
        f"{BASE_URL}/api/admin/users",
        headers=admin_headers,
        json={
            "username": username,
            "email": email,
            "full_name": full_name,
            "password": password,
            "role": role,
            "phone_number": "9876543210"
        }
    )
    if create_res.status_code in [200, 201]:
        return create_res.json()["id"]
    # If already exists, fetch from full list
    res = requests.get(f"{BASE_URL}/api/admin/users?limit=200", headers=admin_headers)
    for u in res.json().get("users", []):
        if u["username"] == username or u.get("email") == email:
            return u["id"]
    raise Exception(f"Failed to get or create user {username}: {create_res.text}")

def clear_user_assignments(admin_headers, user_id):
    res = requests.get(f"{BASE_URL}/api/admin/user-assignments?user_id={user_id}", headers=admin_headers)
    if res.status_code == 200:
        for a in res.json():
            if a["user_id"] == user_id:
                requests.delete(f"{BASE_URL}/api/admin/user-assignments/{a['id']}", headers=admin_headers)

def assign_user_wards(admin_headers, user_id, district, constituency, wards):
    clear_user_assignments(admin_headers, user_id)
    res = requests.post(
        f"{BASE_URL}/api/admin/user-assignments",
        headers=admin_headers,
        json={
            "user_id": user_id,
            "district": district or "District1",
            "constituency": constituency or "const1",
            "wards": wards,
            "area": "All"
        }
    )
    assert res.status_code in [200, 201], f"Failed to assign wards: {res.text}"
    return res.json()

def main():
    log("======================================================================")
    log("VMS MANDATORY WARD ASSIGNMENT & WALLET VALIDATION TEST SUITE")
    log("======================================================================")

    # 1. Login as Super Admin
    log("Step 1: Authenticating Super Admin...")
    admin_token = login("admin", "Admin@12345")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    log("Super Admin authenticated successfully.")

    # 2. Fund Admin Treasury so allocations succeed
    requests.post(
        f"{BASE_URL}/api/admin/wallet/fund",
        headers=admin_headers,
        json={"amount": 20000.0, "payment_method": "Treasury", "remarks": "Test suite topup"}
    )

    # 3. Fetch voters to test against
    log("Step 2: Fetching candidate voters from database...")
    voters_res = requests.get(f"{BASE_URL}/api/voter-records?limit=20", headers=admin_headers)
    assert voters_res.status_code == 200
    voter_records = voters_res.json().get("records", [])
    assert len(voter_records) >= 2, "Need at least 2 voter records in DB"

    # Select target voter
    target_voter = voter_records[0]
    target_voter_id = target_voter["id"]
    target_voter_code = target_voter["unique_key"]

    # Retrieve voter detail to get actual district, constituency, and ward
    detail_res = requests.get(f"{BASE_URL}/api/voters/{target_voter_code}", headers=admin_headers)
    assert detail_res.status_code == 200
    voter_details = detail_res.json()
    actual_district = voter_details.get("district") or "District1"
    actual_constituency = voter_details.get("constituency") or "const1"
    actual_ward = voter_details.get("ward") or voter_details.get("ward_number") or "1"

    log(f"Target Voter: ID {target_voter_id}, Name '{voter_details['voter_name']}', Code '{target_voter_code}'")
    log(f"Actual Geography: District '{actual_district}', Constituency '{actual_constituency}', Ward '{actual_ward}'")

    # Setup dedicated test field user
    test_user_id = get_or_create_user(
        admin_headers,
        username="ward_val_user",
        email="ward_val_user@vms.local",
        full_name="Ward Validation Operator"
    )
    user_token = login("ward_val_user", "User@12345")
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # =========================================================================
    # SCENARIO 1: NO WARD ASSIGNMENT
    # =========================================================================
    log("\n--- SCENARIO 1: No Ward Assignment ---")
    clear_user_assignments(admin_headers, test_user_id)
    log("User has 0 geographic assignments in database.")

    # 1A. Verification attempt
    res_verify_no_ward = requests.get(f"{BASE_URL}/api/voters/verify/{target_voter_code}", headers=user_headers)
    log(f"Lookup status: {res_verify_no_ward.status_code}, Body: {res_verify_no_ward.text}")
    assert res_verify_no_ward.status_code == 403
    assert "No active geographic assignments found" in res_verify_no_ward.json()["detail"] or "No assigned Wards found" in res_verify_no_ward.json()["detail"]

    # 1B. Payment submission attempt
    res_pay_no_ward = requests.post(
        f"{BASE_URL}/api/voters/{target_voter_id}/submit-payment",
        headers=user_headers,
        json={"remarks": "Payment attempt with no ward"}
    )
    log(f"Payment submission status: {res_pay_no_ward.status_code}, Detail: {res_pay_no_ward.text}")
    assert res_pay_no_ward.status_code == 403
    assert "Payment submission is blocked" in res_pay_no_ward.json()["detail"] or "No active geographic assignments" in res_pay_no_ward.json()["detail"]
    log("Scenario 1 PASSED: Payment submission strictly blocked when User has no Ward assignment.")

    # =========================================================================
    # SCENARIO 2: UNASSIGNED WARD
    # =========================================================================
    log("\n--- SCENARIO 2: Unassigned Ward ---")
    # Assign an entirely different ward, e.g. "999" (voter is in actual_ward e.g. "1")
    unassigned_ward_number = "999" if str(actual_ward) != "999" else "888"
    assign_user_wards(admin_headers, test_user_id, actual_district, actual_constituency, [unassigned_ward_number])
    log(f"User assigned ONLY to Ward '{unassigned_ward_number}', while voter is in Ward '{actual_ward}'.")

    # 2A. Verification attempt
    res_verify_unassigned = requests.get(f"{BASE_URL}/api/voters/verify/{target_voter_code}", headers=user_headers)
    log(f"Lookup status: {res_verify_unassigned.status_code}, Detail: {res_verify_unassigned.text}")
    assert res_verify_unassigned.status_code == 403
    assert res_verify_unassigned.json()["detail"] == "This voter does not belong to your assigned Ward."

    # 2B. Payment submission attempt
    res_pay_unassigned = requests.post(
        f"{BASE_URL}/api/voters/{target_voter_id}/submit-payment",
        headers=user_headers,
        json={"remarks": "Payment attempt on unassigned ward"}
    )
    log(f"Payment submission status: {res_pay_unassigned.status_code}, Detail: {res_pay_unassigned.text}")
    assert res_pay_unassigned.status_code == 403
    assert res_pay_unassigned.json()["detail"] == "This voter does not belong to your assigned Ward."
    log("Scenario 2 PASSED: Blocked with exact message 'This voter does not belong to your assigned Ward.'")

    # =========================================================================
    # SCENARIO 3: INSUFFICIENT WALLET BALANCE (ASSIGNED WARD)
    # =========================================================================
    log("\n--- SCENARIO 3: Insufficient Wallet Balance (Assigned Ward) ---")
    # Assign the User to the voter's actual Ward!
    assign_user_wards(admin_headers, test_user_id, actual_district, actual_constituency, [str(actual_ward)])
    log(f"User successfully assigned to voter's actual Ward '{actual_ward}'.")

    # Check user wallet balance (ensure it is 0 or less than 500)
    wb = requests.get(f"{BASE_URL}/api/wallet/balance", headers=user_headers).json()
    log(f"Current User Wallet Balance: ₹{wb['available_balance']}")

    # Pick an unpaid voter in this ward
    unpaid_voter_id = None
    unpaid_voter_code = None
    for cand in voter_records:
        cand_code = cand["unique_key"]
        chk = requests.get(f"{BASE_URL}/api/voters/verify/{cand_code}", headers=user_headers)
        if chk.status_code == 200 and not chk.json().get("is_paid"):
            unpaid_voter_id = cand["id"]
            unpaid_voter_code = cand_code
            break

    assert unpaid_voter_id is not None, "Could not find an unpaid voter in assigned ward for testing"
    log(f"Selected unpaid voter ID {unpaid_voter_id} ({unpaid_voter_code}) for balance tests.")

    if wb["available_balance"] >= 500:
        # Drain wallet or test with a fresh user who has 0 balance
        zero_user_id = get_or_create_user(
            admin_headers,
            username="zero_bal_user",
            email="zero_bal_user@vms.local",
            full_name="Zero Balance Operator"
        )
        assign_user_wards(admin_headers, zero_user_id, actual_district, actual_constituency, [str(actual_ward)])
        zero_token = login("zero_bal_user", "User@12345")
        zero_headers = {"Authorization": f"Bearer {zero_token}"}
        active_test_headers = zero_headers
    else:
        active_test_headers = user_headers

    res_insufficient = requests.post(
        f"{BASE_URL}/api/voters/{unpaid_voter_id}/submit-payment",
        headers=active_test_headers,
        json={"remarks": "Attempt with insufficient balance"}
    )
    log(f"Payment submission status: {res_insufficient.status_code}, Detail: {res_insufficient.text}")
    assert res_insufficient.status_code == 400
    assert "Insufficient Wallet Balance" in res_insufficient.json()["detail"]
    log("Scenario 3 PASSED: Blocked with exact message 'Insufficient Wallet Balance.'")

    # =========================================================================
    # SCENARIO 4: SUFFICIENT WALLET BALANCE (ASSIGNED WARD -> SUCCESS)
    # =========================================================================
    log("\n--- SCENARIO 4: Sufficient Wallet Balance (Assigned Ward -> Success) ---")
    # Fund the test user's wallet with ₹2,000.00
    requests.post(
        f"{BASE_URL}/api/admin/wallet/allocate",
        headers=admin_headers,
        json={"user_id": test_user_id, "amount": 2000.0, "remarks": "Funding for test scenario 4"}
    )
    wb_funded = requests.get(f"{BASE_URL}/api/wallet/balance", headers=user_headers).json()
    starting_balance = wb_funded["available_balance"]
    log(f"User Wallet funded! Available: ₹{starting_balance}")
    assert starting_balance >= 500.0

    # Submit payment for the unpaid voter
    res_pay_success = requests.post(
        f"{BASE_URL}/api/voters/{unpaid_voter_id}/submit-payment",
        headers=user_headers,
        json={"remarks": "Legitimate payment by assigned officer", "idempotency_key": f"IDEMP-{uuid.uuid4().hex[:8]}"}
    )
    log(f"Payment submission status: {res_pay_success.status_code}, Body: {res_pay_success.text}")
    assert res_pay_success.status_code == 200
    pay_data = res_pay_success.json()
    assert pay_data["is_paid"] is True
    assert pay_data["payment_status"] == "PAID"
    assert pay_data["deducted_amount"] == 500.0
    expected_new_balance = starting_balance - 500.0
    assert pay_data["updated_balance"] == expected_new_balance
    assert "transaction_id" in pay_data
    log(f"Scenario 4 PASSED: Payment of ₹500.00 deducted. New Balance: ₹{expected_new_balance}. Status: PAID.")

    # =========================================================================
    # SCENARIO 5: ALREADY-PAID VOTER (NO DOUBLE DEDUCTION)
    # =========================================================================
    log("\n--- SCENARIO 5: Already-Paid Voter (Duplicate Protection) ---")
    # Resubmit payment for the exact same voter that was just paid
    res_dup = requests.post(
        f"{BASE_URL}/api/voters/{unpaid_voter_id}/submit-payment",
        headers=user_headers,
        json={"remarks": "Second payment attempt for same voter"}
    )
    log(f"Duplicate submission status: {res_dup.status_code}, Body: {res_dup.text}")
    assert res_dup.status_code == 200
    dup_data = res_dup.json()
    assert dup_data["is_paid"] is True
    assert dup_data["payment_status"] == "PAID"
    assert dup_data["status"] == "already_paid"
    assert dup_data["transaction_id"] == pay_data["transaction_id"]

    # Verify wallet was NOT deducted again
    wb_check = requests.get(f"{BASE_URL}/api/wallet/balance", headers=user_headers).json()
    assert wb_check["available_balance"] == expected_new_balance, f"Double spend occurred! Balance: {wb_check['available_balance']} vs {expected_new_balance}"
    log(f"Scenario 5 PASSED: Returned existing payment details. Wallet balance unchanged at ₹{wb_check['available_balance']}.")

    # =========================================================================
    # SCENARIO 6: SUPER ADMIN & ADMIN ACCESS HIERARCHY
    # =========================================================================
    log("\n--- SCENARIO 6: Super Admin & Admin Access Scoping ---")
    # 6A. Super Admin can verify any voter regardless of assignments
    sa_res = requests.get(f"{BASE_URL}/api/voters/verify/{target_voter_code}", headers=admin_headers)
    assert sa_res.status_code == 200
    log("Super Admin verified voter across all constituencies/wards.")

    # 6B. Admin cannot access voter outside assigned geographic scope
    admin_user_id = get_or_create_user(
        admin_headers,
        username="scoped_admin",
        email="scoped_admin@vms.local",
        full_name="Scoped Administrator",
        role="ADMIN"
    )
    # Assign Admin only to a foreign constituency
    assign_user_wards(admin_headers, admin_user_id, "ForeignDist", "ForeignConst", ["All"])
    scoped_admin_token = login("scoped_admin", "User@12345")
    scoped_admin_headers = {"Authorization": f"Bearer {scoped_admin_token}"}

    scoped_admin_res = requests.get(f"{BASE_URL}/api/voters/verify/{target_voter_code}", headers=scoped_admin_headers)
    assert scoped_admin_res.status_code == 403
    assert "Access denied" in scoped_admin_res.json()["detail"]
    log("Admin outside geographic scope correctly blocked with 403 Forbidden.")

    log("\n======================================================================")
    log("ALL 6 MANDATORY WARD ASSIGNMENT & WALLET VALIDATION SCENARIOS PASSED 100%!")
    log("======================================================================")

if __name__ == "__main__":
    main()
