import pytest
import requests
import uuid

BASE_URL = "http://127.0.0.1:8000"

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
    # If 400 because already exists, fetch again
    res = requests.get(f"{BASE_URL}/api/admin/users?limit=200", headers=admin_headers)
    for u in res.json().get("users", []):
        if u["username"] == username or u.get("email") == email:
            return u["id"]
    raise Exception(f"Failed to get/create user {username}: {create_res.text}")

@pytest.fixture(scope="module")
def admin_token():
    res = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username_or_email": "admin", "password": "Admin@12345"}
    )
    assert res.status_code == 200
    return res.json()["access_token"]

@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}

@pytest.fixture(scope="module")
def test_user(admin_headers):
    username = "pytest_ward_user"
    email = "pytest_ward_user@vms.local"
    user_id = get_or_create_user(admin_headers, username, email, "Pytest Ward User")

    login_res = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username_or_email": username, "password": "User@12345"}
    )
    token = login_res.json()["access_token"]
    return {"id": user_id, "username": username, "token": token, "headers": {"Authorization": f"Bearer {token}"}}

@pytest.fixture(scope="module")
def sample_voter(admin_headers):
    res = requests.get(f"{BASE_URL}/api/voter-records?limit=10", headers=admin_headers)
    assert res.status_code == 200
    voters = res.json().get("records", [])
    assert len(voters) > 0
    v = voters[0]
    detail = requests.get(f"{BASE_URL}/api/voters/{v['unique_key']}", headers=admin_headers).json()
    return {
        "id": v["id"],
        "unique_key": v["unique_key"],
        "district": detail.get("district") or "District1",
        "constituency": detail.get("constituency") or "const1",
        "ward": detail.get("ward") or detail.get("ward_number") or "1"
    }

def clear_assignments(admin_headers, user_id):
    res = requests.get(f"{BASE_URL}/api/admin/user-assignments?user_id={user_id}", headers=admin_headers)
    if res.status_code == 200:
        for a in res.json():
            if a["user_id"] == user_id:
                requests.delete(f"{BASE_URL}/api/admin/user-assignments/{a['id']}", headers=admin_headers)

def assign_wards(admin_headers, user_id, district, constituency, wards):
    clear_assignments(admin_headers, user_id)
    res = requests.post(
        f"{BASE_URL}/api/admin/user-assignments",
        headers=admin_headers,
        json={
            "user_id": user_id,
            "district": district,
            "constituency": constituency,
            "wards": wards,
            "area": "All"
        }
    )
    assert res.status_code in [200, 201]

def test_no_ward_assignment_blocks_lookup_and_payment(admin_headers, test_user, sample_voter):
    """Test 1: User with no assigned wards is blocked from verifying voter and submitting payment."""
    clear_assignments(admin_headers, test_user["id"])

    # Lookup blocked
    res_verify = requests.get(f"{BASE_URL}/api/voters/verify/{sample_voter['unique_key']}", headers=test_user["headers"])
    assert res_verify.status_code == 403
    assert "No active geographic assignments found" in res_verify.json()["detail"] or "No assigned Wards found" in res_verify.json()["detail"]

    # Payment submission blocked
    res_pay = requests.post(
        f"{BASE_URL}/api/voters/{sample_voter['id']}/submit-payment",
        headers=test_user["headers"],
        json={"remarks": "Attempt with no assigned wards"}
    )
    assert res_pay.status_code == 403
    assert "Payment submission is blocked" in res_pay.json()["detail"] or "No active geographic assignments" in res_pay.json()["detail"]

def test_unassigned_ward_blocks_with_exact_message(admin_headers, test_user, sample_voter):
    """Test 2: User assigned to a different ward is blocked with exact error message."""
    unassigned_ward = "999" if str(sample_voter["ward"]) != "999" else "888"
    assign_wards(admin_headers, test_user["id"], sample_voter["district"], sample_voter["constituency"], [unassigned_ward])

    # Lookup blocked
    res_verify = requests.get(f"{BASE_URL}/api/voters/verify/{sample_voter['unique_key']}", headers=test_user["headers"])
    assert res_verify.status_code == 403
    assert res_verify.json()["detail"] == "This voter does not belong to your assigned Ward."

    # Payment submission blocked
    res_pay = requests.post(
        f"{BASE_URL}/api/voters/{sample_voter['id']}/submit-payment",
        headers=test_user["headers"],
        json={"remarks": "Attempt on unassigned ward"}
    )
    assert res_pay.status_code == 403
    assert res_pay.json()["detail"] == "This voter does not belong to your assigned Ward."

def test_insufficient_wallet_balance_blocks_payment(admin_headers, sample_voter):
    """Test 3: User with assigned ward but insufficient balance is blocked with exact error message."""
    zero_username = "pytest_zero_bal_user"
    zero_email = "pytest_zero_bal@vms.local"
    u_id = get_or_create_user(admin_headers, zero_username, zero_email, "Zero Balance Pytest User")

    assign_wards(admin_headers, u_id, sample_voter["district"], sample_voter["constituency"], [str(sample_voter["ward"])])
    token = requests.post(f"{BASE_URL}/api/auth/login", json={"username_or_email": zero_username, "password": "User@12345"}).json()["access_token"]
    zero_headers = {"Authorization": f"Bearer {token}"}

    # Find an unpaid voter
    voters = requests.get(f"{BASE_URL}/api/voter-records?limit=30", headers=admin_headers).json().get("records", [])
    unpaid_id = None
    for cand in voters:
        c_code = cand["unique_key"]
        chk = requests.get(f"{BASE_URL}/api/voters/verify/{c_code}", headers=zero_headers)
        if chk.status_code == 200 and not chk.json().get("is_paid"):
            unpaid_id = cand["id"]
            break

    if unpaid_id:
        res = requests.post(
            f"{BASE_URL}/api/voters/{unpaid_id}/submit-payment",
            headers=zero_headers,
            json={"remarks": "Payment with zero balance"}
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "Insufficient Wallet Balance."

def test_assigned_ward_and_sufficient_wallet_payment_success(admin_headers, test_user, sample_voter):
    """Test 4: User with assigned ward and sufficient balance succeeds with correct deduction."""
    assign_wards(admin_headers, test_user["id"], sample_voter["district"], sample_voter["constituency"], [str(sample_voter["ward"])])

    # Fund admin and allocate to user
    requests.post(f"{BASE_URL}/api/admin/wallet/fund", headers=admin_headers, json={"amount": 10000.0, "payment_method": "Treasury"})
    requests.post(f"{BASE_URL}/api/admin/wallet/allocate", headers=admin_headers, json={"user_id": test_user["id"], "amount": 1000.0, "remarks": "Pytest fund"})

    wb_before = requests.get(f"{BASE_URL}/api/wallet/balance", headers=test_user["headers"]).json()
    bal_before = wb_before["available_balance"]

    # Find unpaid voter in assigned ward
    voters = requests.get(f"{BASE_URL}/api/voter-records?limit=30", headers=admin_headers).json().get("records", [])
    unpaid_voter = None
    for cand in voters:
        c_code = cand["unique_key"]
        chk = requests.get(f"{BASE_URL}/api/voters/verify/{c_code}", headers=test_user["headers"])
        if chk.status_code == 200 and not chk.json().get("is_paid"):
            unpaid_voter = cand
            break

    if unpaid_voter:
        res = requests.post(
            f"{BASE_URL}/api/voters/{unpaid_voter['id']}/submit-payment",
            headers=test_user["headers"],
            json={"remarks": "Pytest legitimate payment"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["is_paid"] is True
        assert data["payment_status"] == "PAID"
        assert data["deducted_amount"] == 500.0
        assert data["updated_balance"] == bal_before - 500.0
        assert "transaction_id" in data

        # Test 5: Already paid duplicate protection
        res_dup = requests.post(
            f"{BASE_URL}/api/voters/{unpaid_voter['id']}/submit-payment",
            headers=test_user["headers"],
            json={"remarks": "Duplicate attempt"}
        )
        assert res_dup.status_code == 200
        dup_data = res_dup.json()
        assert dup_data["status"] == "already_paid"
        assert dup_data["is_paid"] is True
        assert dup_data["payment_status"] == "PAID"
        assert dup_data["transaction_id"] == data["transaction_id"]

        wb_check = requests.get(f"{BASE_URL}/api/wallet/balance", headers=test_user["headers"]).json()
        assert wb_check["available_balance"] == data["updated_balance"]

def test_super_admin_unrestricted_access(admin_headers, sample_voter):
    """Test 6: Super Admin can verify any voter regardless of geographic assignment."""
    res = requests.get(f"{BASE_URL}/api/voters/verify/{sample_voter['unique_key']}", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["unique_code"] == sample_voter["unique_key"]
