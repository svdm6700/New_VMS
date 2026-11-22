import os
import sys
import requests
from decimal import Decimal

BASE_URL = "http://127.0.0.1:8000"

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

def main():
    log("1. Logging in as superadmin...")
    admin_token = login("admin", "Admin@12345")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    log("Admin login successful.")

    # Fetch a voter record to test with
    log("2. Fetching existing voters...")
    res = requests.get(f"{BASE_URL}/api/voter-records?limit=10", headers=admin_headers)
    assert res.status_code == 200, f"Failed to list voters: {res.text}"
    voters = res.json().get("records", [])
    assert len(voters) > 0, "No voters found in database"
    voter = voters[0]
    voter_id = voter["id"]
    unique_key = voter.get("unique_key")
    assert unique_key and len(unique_key) == 5, f"Invalid unique key: {unique_key}"
    log(f"Selected voter ID: {voter_id}, Name: {voter['voter_name']}, Unique Code: {unique_key}")

    # Create or get a test user with assigned scope
    log("3. Creating or fetching test field user...")
    test_username = "field_officer_test"
    test_email = "field_officer_test@vms.local"
    test_password = "User@12345"

    user_res = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
    all_users = user_res.json().get("items", [])
    matching = [u for u in all_users if u["username"] == test_username or u.get("email") == test_email]
    if matching:
        test_user = matching[0]
        test_user_id = test_user["id"]
        test_username = test_user["username"]
        log(f"Found existing test user ID: {test_user_id} (@{test_username})")
    else:
        create_res = requests.post(
            f"{BASE_URL}/api/admin/users",
            headers=admin_headers,
            json={
                "username": test_username,
                "email": test_email,
                "full_name": "Field Officer Test",
                "password": test_password,
                "role": "USER",
                "phone_number": "9876543210"
            }
        )
        assert create_res.status_code in [200, 201], f"Failed to create user: {create_res.text}"
        test_user_id = create_res.json()["id"]
        log(f"Created test user ID: {test_user_id}")

    # Inspect voter geography
    voter_detail_res = requests.get(f"{BASE_URL}/api/voters/{unique_key}", headers=admin_headers)
    voter_data = voter_detail_res.json()
    district = voter_data.get("district") or "Default District"
    constituency = voter_data.get("constituency")
    ward = voter_data.get("ward") or voter_data.get("ward_number")
    log(f"Voter geography: District '{district}', Constituency '{constituency}', Ward '{ward}'")

    if constituency:
        assign_res = requests.post(
            f"{BASE_URL}/api/admin/user-assignments",
            headers=admin_headers,
            json={
                "user_id": test_user_id,
                "district": district,
                "constituency": constituency,
                "wards": [str(ward)] if ward else ["All"],
                "area": "All"
            }
        )
        log(f"Assignment status: {assign_res.status_code}")
        assert assign_res.status_code in [200, 201, 400], f"Assignment failed: {assign_res.text}"

    user_token = login(test_username, test_password)
    user_headers = {"Authorization": f"Bearer {user_token}"}
    log("Test field user login successful.")

    # Test 4: Verify Voter API
    log("4. Testing GET /api/voters/verify/{unique_code} as User...")
    verify_res = requests.get(f"{BASE_URL}/api/voters/verify/{unique_key}", headers=user_headers)
    assert verify_res.status_code == 200, f"Verify failed: {verify_res.status_code} {verify_res.text}"
    v_info = verify_res.json()
    assert v_info["unique_code"] == unique_key
    assert "applicable_amount" in v_info
    assert "user_wallet_balance" in v_info
    log(f"Voter verified successfully! Applicable Amount: ₹{v_info['applicable_amount']}, Wallet Balance: ₹{v_info['user_wallet_balance']}, is_paid: {v_info.get('is_paid')}")

    # Test 5: Check Wallet Balance API
    log("5. Testing GET /api/wallet/balance...")
    wb_res = requests.get(f"{BASE_URL}/api/wallet/balance", headers=user_headers)
    assert wb_res.status_code == 200, f"Wallet balance failed: {wb_res.text}"
    wb_data = wb_res.json()
    log(f"User Wallet Balance: ₹{wb_data['available_balance']}")

    # If balance is insufficient and voter is not yet paid, test rejection
    if not v_info.get("is_paid") and wb_data["available_balance"] < 500:
        log("6. Testing Insufficient Balance rejection (HTTP 400)...")
        fail_pay_res = requests.post(
            f"{BASE_URL}/api/voters/{voter_id}/submit-payment",
            headers=user_headers,
            json={"remarks": "Attempt with insufficient balance"}
        )
        assert fail_pay_res.status_code == 400, f"Expected 400 for insufficient balance, got {fail_pay_res.status_code}"
        assert "Insufficient Wallet Balance" in fail_pay_res.json()["detail"]
        log("Insufficient balance correctly rejected with HTTP 400!")

    # Fund admin wallet and allocate to user wallet
    log("7. Funding Admin Treasury and Allocating to User Wallet...")
    fund_admin_res = requests.post(
        f"{BASE_URL}/api/admin/wallet/fund",
        headers=admin_headers,
        json={
            "amount": 10000.0,
            "payment_method": "Bank Transfer",
            "transaction_reference": "FUND-REF-10000",
            "remarks": "Treasury Top-up for verification testing"
        }
    )
    log(f"Admin Treasury funding status: {fund_admin_res.status_code}")

    alloc_res = requests.post(
        f"{BASE_URL}/api/admin/wallet/allocate",
        headers=admin_headers,
        json={
            "user_id": test_user_id,
            "amount": 2500.0,
            "remarks": "Allocation for field voter verification"
        }
    )
    log(f"User allocation status: {alloc_res.status_code}")

    wb_after = requests.get(f"{BASE_URL}/api/wallet/balance", headers=user_headers).json()
    log(f"Funded User Wallet Balance: ₹{wb_after['available_balance']}")
    assert wb_after["available_balance"] >= 500, f"Balance still insufficient: {wb_after['available_balance']}"

    # Pick an unpaid voter if voter 0 was already paid
    test_voter_id = voter_id
    test_voter_code = unique_key
    if v_info.get("is_paid"):
        log("Voter 0 is already paid. Searching for an unpaid voter in assigned area...")
        for cand in voters[1:]:
            cand_code = cand.get("unique_key")
            if not cand_code:
                continue
            cand_chk = requests.get(f"{BASE_URL}/api/voters/verify/{cand_code}", headers=user_headers)
            if cand_chk.status_code == 200 and not cand_chk.json().get("is_paid"):
                test_voter_id = cand["id"]
                test_voter_code = cand_code
                log(f"Found unpaid voter ID {test_voter_id} ({test_voter_code})")
                break

    # Test 8: Submit Voter Payment
    prev_balance = wb_after["available_balance"]
    log(f"8. Submitting payment for voter ID {test_voter_id} ({test_voter_code})...")
    pay_res = requests.post(
        f"{BASE_URL}/api/voters/{test_voter_id}/submit-payment",
        headers=user_headers,
        json={"remarks": "Payment verified at booth", "idempotency_key": f"TEST-TX-{test_voter_id}"}
    )
    assert pay_res.status_code == 200, f"Payment submission failed: {pay_res.status_code} {pay_res.text}"
    pay_data = pay_res.json()
    assert pay_data["is_paid"] is True
    assert pay_data["payment_status"] == "PAID"
    assert "transaction_id" in pay_data
    log(f"Payment successful! Status: {pay_data['payment_status']}, Deducted: ₹{pay_data.get('deducted_amount')}, Updated Balance: ₹{pay_data.get('updated_balance')}, TxID: {pay_data['transaction_id']}")

    # Test 9: Idempotency / No Double Spend
    balance_after_pay = pay_data.get("updated_balance")
    log("9. Testing Idempotency & Duplicate Protection (submitting again for same voter)...")
    dup_res = requests.post(
        f"{BASE_URL}/api/voters/{test_voter_id}/submit-payment",
        headers=user_headers,
        json={"remarks": "Duplicate attempt"}
    )
    assert dup_res.status_code == 200, f"Duplicate request failed: {dup_res.status_code} {dup_res.text}"
    dup_data = dup_res.json()
    assert dup_data["is_paid"] is True
    assert dup_data["payment_status"] == "PAID"

    current_wb = requests.get(f"{BASE_URL}/api/wallet/balance", headers=user_headers).json()
    assert current_wb["available_balance"] == balance_after_pay, f"Double deduction occurred! {current_wb['available_balance']} vs {balance_after_pay}"
    log(f"Zero double deduction! Balance remained intact at ₹{current_wb['available_balance']}")

    # Test 10: Update Remarks without money deduction
    log("10. Testing PATCH /api/voters/{voter_id}/remarks...")
    remark_res = requests.patch(
        f"{BASE_URL}/api/voters/{test_voter_id}/remarks",
        headers=user_headers,
        json={"remarks": "Updated remarks: Voter acknowledged receipt"}
    )
    assert remark_res.status_code == 200, f"Remarks update failed: {remark_res.text}"
    log(f"Remarks updated: {remark_res.json()['remarks']}")

    # Verify via verify endpoint
    reverify_res = requests.get(f"{BASE_URL}/api/voters/verify/{test_voter_code}", headers=user_headers)
    assert reverify_res.status_code == 200
    rev_info = reverify_res.json()
    assert rev_info["is_paid"] is True
    assert rev_info["remarks"] == "Updated remarks: Voter acknowledged receipt"
    log("Voter verification now returns is_paid=True and updated remarks correctly!")

    # Test 11: Invalid 5-char code returns 404
    log("11. Testing Invalid Voter Code lookup (HTTP 404)...")
    inv_res = requests.get(f"{BASE_URL}/api/voters/verify/ZZZZZ", headers=user_headers)
    assert inv_res.status_code == 404, f"Expected 404, got {inv_res.status_code}"
    log("Invalid code correctly returned 404!")

    log("\n=======================================================")
    log("ALL VOTER PAYMENT AND WALLET DEDUCTION TESTS PASSED 100%!")
    log("=======================================================")

if __name__ == "__main__":
    main()
