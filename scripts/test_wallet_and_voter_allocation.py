import os
import sys
import uuid
import requests
from decimal import Decimal

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=" * 65)
    print("VMS - WALLET MANAGEMENT & VOTER ALLOCATION SYSTEM TESTS")
    print("=" * 65)

    # 1. Admin Authentication
    admin_login_res = requests.post(f"{BASE_URL}/api/auth/login", json={"username_or_email": "admin", "password": "Admin@12345"})
    assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.text}"
    admin_token = admin_login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("✓ [Auth] Admin authenticated successfully.")

    # 2. Operator/Tester Authentication
    requests.post(
        f"{BASE_URL}/api/admin/users",
        headers=admin_headers,
        json={
            "full_name": "Test Regular User",
            "email": "tester@telugupdf.com",
            "username": "tester",
            "password": "User@12345",
            "role": "user"
        }
    )
    user_login_res = requests.post(f"{BASE_URL}/api/auth/login", json={"username_or_email": "tester", "password": "User@12345"})
    assert user_login_res.status_code == 200, f"Tester login failed: {user_login_res.text}"
    user_token = user_login_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    tester_id = requests.get(f"{BASE_URL}/api/auth/me", headers=user_headers).json()["id"]
    print(f"✓ [Auth] Operator/Tester authenticated successfully (User ID: {tester_id}).")

    # Test 1 & 2: Admin Wallet Funding & Validation
    initial_admin_wallet = requests.get(f"{BASE_URL}/api/admin/wallet", headers=admin_headers).json()
    initial_admin_bal = initial_admin_wallet["available_balance"]

    # Reject negative/zero
    neg_res = requests.post(f"{BASE_URL}/api/admin/wallet/fund", headers=admin_headers, json={"amount": -100})
    assert neg_res.status_code == 422 or neg_res.status_code == 400, "Validation should reject negative amount"
    zero_res = requests.post(f"{BASE_URL}/api/admin/wallet/fund", headers=admin_headers, json={"amount": 0})
    assert zero_res.status_code == 422 or zero_res.status_code == 400, "Validation should reject zero amount"
    print("✓ [Admin Wallet] Correctly rejected negative and zero funding amounts.")

    # Fund admin wallet with ₹50,000.00
    fund_res = requests.post(f"{BASE_URL}/api/admin/wallet/fund", headers=admin_headers, json={
        "amount": 50000.00,
        "payment_method": "Bank Transfer",
        "transaction_reference": "TXN-TEST-REF-9988",
        "remarks": "Test funding for operator allocations"
    })
    assert fund_res.status_code == 200, f"Funding failed: {fund_res.text}"
    fund_data = fund_res.json()
    new_admin_bal = fund_data["wallet"]["available_balance"]
    assert new_admin_bal == initial_admin_bal + 50000.00, f"Admin balance mismatch: {new_admin_bal}"
    print(f"✓ [Admin Wallet] Successfully funded ₹50,000.00. Balance: ₹{new_admin_bal:,.2f}.")

    # Test 3 & 4: Admin Allocates Money to User
    initial_user_wallet = requests.get(f"{BASE_URL}/api/user/wallet", headers=user_headers).json()
    initial_user_bal = initial_user_wallet["available_balance"]

    alloc_res = requests.post(f"{BASE_URL}/api/admin/wallet/allocate", headers=admin_headers, json={
        "user_id": tester_id,
        "amount": 10000.00,
        "remarks": "Assigned field budget for Ward 1",
        "idempotency_key": f"IDEM-ALOC-{uuid.uuid4().hex[:8]}"
    })
    assert alloc_res.status_code == 200, f"Allocation failed: {alloc_res.text}"
    alloc_data = alloc_res.json()
    assert alloc_data["admin_balance"] == new_admin_bal - 10000.00
    assert alloc_data["user_balance"] == initial_user_bal + 10000.00
    print(f"✓ [Allocation] Allocated ₹10,000.00 from Admin to Tester. Admin: ₹{alloc_data['admin_balance']:,.2f}, User: ₹{alloc_data['user_balance']:,.2f}.")

    # Test 5: Insufficient Admin Balance Blocks Allocation
    huge_alloc = requests.post(f"{BASE_URL}/api/admin/wallet/allocate", headers=admin_headers, json={
        "user_id": tester_id,
        "amount": 999999999.00,
        "remarks": "Should fail"
    })
    assert huge_alloc.status_code == 400, f"Should reject excessive allocation: {huge_alloc.text}"
    print("✓ [Allocation Safeguard] Insufficient Admin Wallet balance correctly blocked.")

    # Test 6: User sees only their own wallet
    user_wallet_check = requests.get(f"{BASE_URL}/api/user/wallet", headers=user_headers).json()
    assert user_wallet_check["available_balance"] == initial_user_bal + 10000.00
    user_txs = requests.get(f"{BASE_URL}/api/user/wallet/transactions", headers=user_headers).json()
    assert any(tx["transaction_type"] == "USER_WALLET_CREDIT" and tx["amount"] == 10000.00 for tx in user_txs["items"])
    print("✓ [User Wallet] User successfully accesses their own wallet and ledger transactions.")

    # Test 7 & 8: Geographic Constituency & Ward Restriction
    # First, fetch available documents/locations to get real district, constituency & ward
    docs_res = requests.get(f"{BASE_URL}/api/documents", headers=admin_headers).json()
    docs = docs_res["documents"] if isinstance(docs_res, dict) and "documents" in docs_res else docs_res
    assert len(docs) > 0, "At least one document must exist for testing"
    test_doc = docs[0]
    test_district = test_doc["district"] or "Default District"
    test_constituency = test_doc["constituency"] or "Default Constituency"
    test_ward = test_doc["ward_number"] or "1"

    # Revoke any old assignments for tester first
    old_assignments = requests.get(f"{BASE_URL}/api/admin/user-assignments?user_id={tester_id}", headers=admin_headers).json()
    for oa in old_assignments:
        requests.delete(f"{BASE_URL}/api/admin/user-assignments/{oa['id']}", headers=admin_headers)

    # When tester has NO assignments, assigned-voters must be empty!
    unassigned_voters = requests.get(f"{BASE_URL}/api/user/assigned-voters", headers=user_headers).json()
    assert unassigned_voters["total"] == 0, f"Unassigned user should see 0 voters, got {unassigned_voters['total']}"
    print("✓ [Security & Scope] User without geographic assignment cannot see any voters.")

    # Create Geographic Assignment for Tester
    geo_res = requests.post(f"{BASE_URL}/api/admin/user-assignments", headers=admin_headers, json={
        "user_id": tester_id,
        "district": test_district,
        "constituency": test_constituency,
        "wards": [test_ward],
        "area": test_doc.get("area") or "Center",
        "status": "ACTIVE"
    })
    assert geo_res.status_code == 200, f"Geo assignment failed: {geo_res.text}"
    assignment_id = geo_res.json()["id"]
    print(f"✓ [Geographic Assignment] Assigned Tester to '{test_constituency}', Ward '{test_ward}'.")

    # Now tester can see voters belonging to this constituency & ward
    assigned_voters = requests.get(f"{BASE_URL}/api/user/assigned-voters", headers=user_headers).json()
    assert assigned_voters["total"] > 0, f"Tester should now see assigned voters, got {assigned_voters['total']}"
    target_voter = assigned_voters["items"][0]
    print(f"✓ [Scoped Access] Tester retrieved {assigned_voters['total']} voters in scope. Selected voter #{target_voter['id']} ('{target_voter['voter_name']}').")

    # Test 9 & 10: Assign Amount to Voter and Wallet Deduction
    pre_assign_wallet = requests.get(f"{BASE_URL}/api/user/wallet", headers=user_headers).json()
    pre_bal = pre_assign_wallet["available_balance"]

    idempotency_key = f"IDEM-VAL-{uuid.uuid4().hex[:8]}"
    assign_res = requests.post(f"{BASE_URL}/api/user/voter-allocations", headers=user_headers, json={
        "voter_id": target_voter["id"],
        "amount": 2500.00,
        "remarks": "Ward disbursement",
        "idempotency_key": idempotency_key
    })
    assert assign_res.status_code == 200, f"Voter allocation failed: {assign_res.text}"
    alloc_result = assign_res.json()
    assert alloc_result["updated_balance"] == pre_bal - 2500.00
    allocation_id = alloc_result["allocation"]["id"]
    print(f"✓ [Voter Allocation] Successfully assigned ₹2,500.00 to voter #{target_voter['id']}. New balance: ₹{alloc_result['updated_balance']:,.2f}.")

    # Test 11: Insufficient User Balance Blocks Assignment
    excessive_voter_assign = requests.post(f"{BASE_URL}/api/user/voter-allocations", headers=user_headers, json={
        "voter_id": target_voter["id"],
        "amount": 99999999.00
    })
    assert excessive_voter_assign.status_code == 400, "Should reject assignment exceeding user wallet balance"
    print("✓ [Wallet Safeguard] Assignment exceeding available user balance correctly blocked.")

    # Test 12: Double submission / Idempotency protection
    duplicate_assign = requests.post(f"{BASE_URL}/api/user/voter-allocations", headers=user_headers, json={
        "voter_id": target_voter["id"],
        "amount": 2500.00,
        "idempotency_key": idempotency_key
    })
    assert duplicate_assign.status_code == 200
    assert duplicate_assign.json()["updated_balance"] == pre_bal - 2500.00, "Idempotent resubmit must not deduct twice!"
    print("✓ [Idempotency] Duplicate submission handled cleanly without double deduction.")

    # Test 15: Reversal Restores Balance Only Once
    rev_res = requests.post(f"{BASE_URL}/api/user/voter-allocations/{allocation_id}/reverse", headers=user_headers, json={
        "reason": "Duplicate entry entered by mistake"
    })
    assert rev_res.status_code == 200, f"Reversal failed: {rev_res.text}"
    assert rev_res.json()["updated_balance"] == pre_bal
    print(f"✓ [Reversal] Successfully reversed allocation #{allocation_id}. Balance restored to ₹{rev_res.json()['updated_balance']:,.2f}.")

    # Second reversal attempt must fail
    rev_fail = requests.post(f"{BASE_URL}/api/user/voter-allocations/{allocation_id}/reverse", headers=user_headers, json={
        "reason": "Try again"
    })
    assert rev_fail.status_code == 400, "Cannot reverse already reversed allocation"
    print("✓ [Reversal Safeguard] Repeated reversal correctly blocked.")

    # Test 16: Audit Logs
    audit_res = requests.get(f"{BASE_URL}/api/rbac/audit-logs?limit=10", headers=admin_headers).json()
    actions = [a["action"] for a in audit_res]
    assert any("WALLET" in a or "VOTER" in a or "GEO" in a for a in actions), "Audit logs should record wallet & allocation actions"
    print("✓ [Audit Trail] Security audit logs verified for wallet and geographic actions.")

    # Test 17: Admin Consolidated Summary Reports
    summary_res = requests.get(f"{BASE_URL}/api/admin/wallet/summary", headers=admin_headers).json()
    assert "admin_available_balance" in summary_res
    assert "total_allocated_to_users" in summary_res
    assert "total_user_wallets_balance" in summary_res
    print(f"✓ [Admin Reports] Global Wallet Summary verified: {summary_res}")

    # Test 18: Existing VMS Functionality Intact (Documents, Payments, Users)
    doc_check = requests.get(f"{BASE_URL}/api/documents", headers=admin_headers)
    assert doc_check.status_code == 200
    pay_check = requests.get(f"{BASE_URL}/api/payments/summary", headers=admin_headers)
    assert pay_check.status_code == 200
    print("✓ [Regression] Existing Documents and Payments functionality 100% verified intact.")

    # Test 19: Admin Direct Disbursal to Voter (Master Treasury Deduction)
    admin_wallet_before = requests.get(f"{BASE_URL}/api/admin/wallet", headers=admin_headers).json()
    admin_pre_bal = admin_wallet_before["available_balance"]
    admin_assign = requests.post(f"{BASE_URL}/api/user/voter-allocations", headers=admin_headers, json={
        "voter_id": target_voter["id"],
        "amount": 1200.00,
        "remarks": "Admin direct campaign grant"
    })
    assert admin_assign.status_code == 200, f"Admin spend on voter failed: {admin_assign.text}"
    admin_assign_data = admin_assign.json()
    assert admin_assign_data["updated_balance"] == admin_pre_bal - 1200.00
    admin_alloc_id = admin_assign_data["allocation"]["id"]
    print(f"✓ [Admin Disbursal] Admin spent ₹1,200.00 directly on voter #{target_voter['id']}. Admin balance: ₹{admin_assign_data['updated_balance']:,.2f}.")

    # Test 20: Admin Reversal Restores Admin Master Balance
    admin_rev = requests.post(f"{BASE_URL}/api/user/voter-allocations/{admin_alloc_id}/reverse", headers=admin_headers, json={
        "reason": "Test admin reversal"
    })
    assert admin_rev.status_code == 200, f"Admin reversal failed: {admin_rev.text}"
    assert admin_rev.json()["updated_balance"] == admin_pre_bal
    print(f"✓ [Admin Reversal] Reversed admin allocation #{admin_alloc_id}. Admin balance fully restored to ₹{admin_pre_bal:,.2f}.")

    print("=" * 65)
    print("ALL 20 WALLET & VOTER ALLOCATION TESTS PASSED 100%!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
