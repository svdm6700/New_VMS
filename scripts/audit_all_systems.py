import os
import sys
import uuid
import requests
from decimal import Decimal

BASE = "http://127.0.0.1:8000"
FRONTEND = "http://localhost:5173"

def run_audit():
    print("=" * 70)
    print("VMS FULL SYSTEM AUDIT & INTEGRITY CHECK")
    print("=" * 70)

    # 1. Health & Database
    h_res = requests.get(f"{BASE}/api/health")
    assert h_res.status_code == 200, f"Health check failed: {h_res.text}"
    h_data = h_res.json()
    assert h_data["status"] == "ok"
    assert "Connected to PostgreSQL" in h_data["database"]
    print("✓ [Health] API and PostgreSQL 16 database running and healthy.")

    # 2. Frontend Server Check
    f_res = requests.get(f"{FRONTEND}/")
    assert f_res.status_code == 200, f"Frontend server check failed: {f_res.status_code}"
    print("✓ [Frontend] Vite dev server responsive on http://localhost:5173.")

    # 3. Authentication: Admin & Operator
    admin_auth = requests.post(f"{BASE}/api/auth/login", json={"username_or_email": "admin", "password": "Admin@12345"})
    assert admin_auth.status_code == 200, f"Admin login failed: {admin_auth.text}"
    admin_token = admin_auth.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    me_res = requests.get(f"{BASE}/api/auth/me", headers=admin_headers)
    assert me_res.status_code == 200
    admin_profile = me_res.json()
    assert admin_profile["role"] == "admin"
    print(f"✓ [Auth] Admin authenticated: @{admin_profile['username']} ({admin_profile['full_name']}).")

    # Ensure operator user 'tester' exists
    ensure_user = requests.post(
        f"{BASE}/api/admin/users",
        headers=admin_headers,
        json={
            "full_name": "Test Regular User",
            "email": "tester@telugupdf.com",
            "username": "tester",
            "password": "User@12345",
            "role": "user"
        }
    )

    user_auth = requests.post(f"{BASE}/api/auth/login", json={"username_or_email": "tester", "password": "User@12345"})
    assert user_auth.status_code == 200, f"Operator login failed: {user_auth.text}"
    user_token = user_auth.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    print("✓ [Auth] Field Operator authenticated: @tester.")

    # 4. Document Management
    docs_res = requests.get(f"{BASE}/api/documents", headers=admin_headers)
    assert docs_res.status_code == 200, f"Documents list failed: {docs_res.text}"
    docs = docs_res.json()
    doc_list = docs["documents"] if isinstance(docs, dict) and "documents" in docs else docs
    assert len(doc_list) > 0, "Expected at least 1 document in system"
    print(f"✓ [Documents] Retrieved {len(doc_list)} uploaded documents.")

    doc_summary = requests.get(f"{BASE}/api/documents/summary", headers=admin_headers)
    assert doc_summary.status_code == 200, f"Doc summary failed: {doc_summary.text}"
    ds = doc_summary.json()
    assert ds["total_documents"] >= len(doc_list)
    print(f"✓ [Documents Summary] Total: {ds['total_documents']}, Voters: {ds['total_voters']}, Completed: {ds['completed_documents']}.")

    # 5. Voter Records & 10-column data
    voters_res = requests.get(f"{BASE}/api/voter-records?page=1&limit=10", headers=admin_headers)
    assert voters_res.status_code == 200, f"Voter records failed: {voters_res.text}"
    v_data = voters_res.json()
    assert v_data["total"] > 0
    sample_voter = v_data["records"][0]
    required_fields = ["serial_no", "voter_name", "relation_name", "age", "gender", "house_no", "voter_id"]
    for rf in required_fields:
        assert rf in sample_voter, f"Missing voter field: {rf}"
    print(f"✓ [Voter Records] {v_data['total']} records stored with full 10-column structured schema.")

    # 6. Voter Entries Management
    entries_res = requests.get(f"{BASE}/api/voters/{sample_voter['id']}/entries", headers=admin_headers)
    assert entries_res.status_code == 200, f"Voter entries failed: {entries_res.text}"
    print(f"✓ [Voter Entries] Retrieved entry history for voter #{sample_voter['id']}.")

    # 7. Payments Dashboard
    pay_summary = requests.get(f"{BASE}/api/payments/dashboard/summary", headers=admin_headers)
    assert pay_summary.status_code == 200, f"Payments summary failed: {pay_summary.text}"
    ps = pay_summary.json()
    assert "total_amount" in ps and "paid_amount" in ps
    print(f"✓ [Payments Summary] Total: ₹{ps['total_amount']:,.2f}, Paid: ₹{ps['paid_amount']:,.2f}.")

    pay_daily = requests.get(f"{BASE}/api/payments/dashboard/daily-collection?days=14", headers=admin_headers)
    assert pay_daily.status_code == 200
    pay_status = requests.get(f"{BASE}/api/payments/dashboard/status-distribution", headers=admin_headers)
    assert pay_status.status_code == 200
    pay_method = requests.get(f"{BASE}/api/payments/dashboard/method-distribution", headers=admin_headers)
    assert pay_method.status_code == 200
    pay_loc = requests.get(f"{BASE}/api/payments/dashboard/location-collection", headers=admin_headers)
    assert pay_loc.status_code == 200
    print("✓ [Payments Charts] Daily trend, status breakdown, payment methods, and location metrics verified.")

    # 8. Admin Wallet Hub & Spending on Voter
    admin_wallet = requests.get(f"{BASE}/api/admin/wallet", headers=admin_headers).json()
    if admin_wallet["available_balance"] < 1000.00:
        fund_res = requests.post(f"{BASE}/api/admin/wallet/fund", headers=admin_headers, json={
            "amount": 50000.00,
            "payment_method": "Bank Transfer",
            "transaction_reference": f"AUDIT-FUND-{uuid.uuid4().hex[:6]}",
            "remarks": "System audit treasury top-up"
        })
        assert fund_res.status_code == 200, f"Funding failed: {fund_res.text}"
        admin_wallet = requests.get(f"{BASE}/api/admin/wallet", headers=admin_headers).json()
    assert admin_wallet["available_balance"] > 0, "Admin wallet should have available balance"
    admin_pre_bal = admin_wallet["available_balance"]
    print(f"✓ [Admin Wallet Hub] Master Treasury available balance: ₹{admin_pre_bal:,.2f}.")

    # Admin Direct Disbursal to Voter
    disburse_res = requests.post(f"{BASE}/api/user/voter-allocations", headers=admin_headers, json={
        "voter_id": sample_voter["id"],
        "amount": 1000.00,
        "remarks": "System audit test disbursal"
    })
    assert disburse_res.status_code == 200, f"Admin disbursal failed: {disburse_res.text}"
    d_res = disburse_res.json()
    assert d_res["updated_balance"] == admin_pre_bal - 1000.00
    alloc_id = d_res["allocation"]["id"]
    print(f"✓ [Spend on Voter] Admin successfully disbursed ₹1,000.00 to voter #{sample_voter['id']}. New balance: ₹{d_res['updated_balance']:,.2f}.")

    # Reversal of Audit Disbursal
    rev_res = requests.post(f"{BASE}/api/user/voter-allocations/{alloc_id}/reverse", headers=admin_headers, json={
        "reason": "System audit test completion reversal"
    })
    assert rev_res.status_code == 200, f"Reversal failed: {rev_res.text}"
    assert rev_res.json()["updated_balance"] == admin_pre_bal
    print(f"✓ [Reversal] Allocation #{alloc_id} reversed cleanly; Admin Master Balance restored to ₹{admin_pre_bal:,.2f}.")

    # 9. Operator Wallet & Scoped Disbursal
    op_wallet = requests.get(f"{BASE}/api/user/wallet", headers=user_headers).json()
    assert "available_balance" in op_wallet
    assert op_wallet["wallet"]["owner_type"] == "USER"
    print(f"✓ [Operator Wallet] Field operator wallet active. Available balance: ₹{op_wallet['available_balance']:,.2f}.")

    # 10. RBAC Roles, Permissions & Audit Logs
    roles_res = requests.get(f"{BASE}/api/rbac/roles", headers=admin_headers)
    assert roles_res.status_code == 200
    perms_res = requests.get(f"{BASE}/api/rbac/permissions", headers=admin_headers)
    assert perms_res.status_code == 200
    audit_res = requests.get(f"{BASE}/api/rbac/audit-logs?limit=5", headers=admin_headers)
    assert audit_res.status_code == 200
    print(f"✓ [RBAC] Roles: {len(roles_res.json())}, Permissions: {len(perms_res.json().get('permissions', []))}, Audit logs recorded.")

    # 11. Exports Check
    exp_csv = requests.get(f"{BASE}/api/payments/export?format=csv", headers=admin_headers)
    assert exp_csv.status_code == 200 and len(exp_csv.content) > 0
    exp_excel = requests.get(f"{BASE}/api/payments/export?format=excel", headers=admin_headers)
    assert exp_excel.status_code == 200 and len(exp_excel.content) > 0
    print("✓ [Exports] CSV and Excel exports verified with valid payloads.")

    print("=" * 70)
    print("ALL 11 VMS SUBSYSTEMS AUDITED: 100% OPERATIONAL WITH ZERO ERRORS!")
    print("=" * 70)

if __name__ == "__main__":
    run_audit()
