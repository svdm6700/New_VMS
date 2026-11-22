import urllib.request
import json
import urllib.parse
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=" * 60)
    print("VMS Payments Dashboard & Complete Functionality Verification")
    print("=" * 60)

    # 1. Login
    login_data = json.dumps({"username_or_email": "admin", "password": "Admin@12345"}).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/api/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        auth_res = json.loads(resp.read().decode())
    token = auth_res["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    print("✓ [Auth] Successfully logged in as Administrator.")

    # 2. Payments Summary
    req = urllib.request.Request(f"{BASE_URL}/api/payments/dashboard/summary", headers=headers)
    with urllib.request.urlopen(req) as resp:
        summary = json.loads(resp.read().decode())
    print("✓ [Summary] 7 KPI Metrics:", {
        "Total Txns": summary["total_transactions"],
        "Total Amount": summary["total_amount_recorded"],
        "Paid Amount": summary["paid_amount"],
        "Pending Amount": summary["pending_amount"],
        "Failed Count": summary["failed_transactions"],
        "Today Collection": summary["today_collection"],
        "This Month Collection": summary["this_month_collection"]
    })
    assert "total_transactions" in summary
    assert "paid_amount" in summary

    # 3. Daily Collection Chart API
    req = urllib.request.Request(f"{BASE_URL}/api/payments/dashboard/daily-collection?days=14", headers=headers)
    with urllib.request.urlopen(req) as resp:
        daily = json.loads(resp.read().decode())
    print(f"✓ [Daily Chart] Retrieved {len(daily)} daily collection data points.")

    # 4. Status Distribution Chart API
    req = urllib.request.Request(f"{BASE_URL}/api/payments/dashboard/status-distribution", headers=headers)
    with urllib.request.urlopen(req) as resp:
        status_dist = json.loads(resp.read().decode())
    print(f"✓ [Status Dist] Retrieved status distribution: {[s['status'] for s in status_dist]}")

    # 5. Method Distribution Chart API
    req = urllib.request.Request(f"{BASE_URL}/api/payments/dashboard/method-distribution", headers=headers)
    with urllib.request.urlopen(req) as resp:
        method_dist = json.loads(resp.read().decode())
    print(f"✓ [Method Dist] Retrieved method distribution: {[m['method'] for m in method_dist]}")

    # 6. Location Collection API
    req = urllib.request.Request(f"{BASE_URL}/api/payments/dashboard/location-collection", headers=headers)
    with urllib.request.urlopen(req) as resp:
        loc = json.loads(resp.read().decode())
    print(f"✓ [Location Metrics] Districts: {len(loc['districts'])}, Constituencies: {len(loc['constituencies'])}")

    # 7. Search Voter for Payment
    q_enc = urllib.parse.quote("అందే")
    req = urllib.request.Request(f"{BASE_URL}/api/payments/voters/search?q={q_enc}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        voters = json.loads(resp.read().decode())
    print(f"✓ [Voter Search] Found {len(voters)} voters matching Telugu name query.")
    assert len(voters) > 0
    target_voter = voters[0]

    # 8. Create New Payment (Pending)
    import uuid
    unique_ref = f"UPI-REF-{uuid.uuid4().hex[:8].upper()}"
    create_payload = json.dumps({
        "voter_id": target_voter["id"],
        "mobile_number": "9848012345",
        "amount": 2500.50,
        "payment_date": "2026-11-22",
        "payment_method": "UPI",
        "payment_status": "Pending",
        "transaction_reference": unique_ref,
        "remarks": "Welfare assistance pending verification"
    }).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/payments", data=create_payload, headers=headers)
    with urllib.request.urlopen(req) as resp:
        new_payment = json.loads(resp.read().decode())
    payment_id = new_payment["payment"]["id"]
    txn_id = new_payment["payment"]["transaction_id"]
    rcp_no = new_payment["payment"]["receipt_number"]
    print(f"✓ [Create Payment] Created payment ID {payment_id} ({txn_id}, Receipt: {rcp_no}, Status: {new_payment['payment']['payment_status']})")

    # 9. Get Receipt
    req = urllib.request.Request(f"{BASE_URL}/api/payments/{payment_id}/receipt", headers=headers)
    with urllib.request.urlopen(req) as resp:
        receipt = json.loads(resp.read().decode())
    print(f"✓ [Receipt] Generated receipt for {txn_id}: Title='{receipt['receipt_title']}', Amount in Words='{receipt['amount_in_words']}'")
    assert "Two Thousand Five Hundred" in receipt["amount_in_words"]

    # 10. Verify Payment (Pending -> Paid)
    req = urllib.request.Request(f"{BASE_URL}/api/payments/{payment_id}/verify", data=b"{}", headers=headers)
    with urllib.request.urlopen(req) as resp:
        verified_res = json.loads(resp.read().decode())
    assert verified_res["payment"]["payment_status"] == "Paid"
    print(f"✓ [Verify Payment] Payment {txn_id} successfully verified as Paid by @{verified_res['payment']['verifier_name']}")

    # 11. Voter Payment History
    req = urllib.request.Request(f"{BASE_URL}/api/payments/voters/{target_voter['id']}/history", headers=headers)
    with urllib.request.urlopen(req) as resp:
        history = json.loads(resp.read().decode())
    print(f"✓ [Voter History] Voter {target_voter['voter_name']} has {history['summary']['payments_count']} payments, Total Paid: ₹{history['summary']['total_paid']}")

    # 12. Refund Payment
    refund_payload = json.dumps({"reason": "Duplicate registration payment approved for full refund"}).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/payments/{payment_id}/refund", data=refund_payload, headers=headers)
    with urllib.request.urlopen(req) as resp:
        refund_res = json.loads(resp.read().decode())
    assert refund_res["payment"]["payment_status"] == "Refunded"
    print(f"✓ [Refund Payment] Payment {txn_id} successfully marked as Refunded.")

    # 13. Reports API
    req = urllib.request.Request(f"{BASE_URL}/api/payments/reports", headers=headers)
    with urllib.request.urlopen(req) as resp:
        reports = json.loads(resp.read().decode())
    print(f"✓ [Reports] Report generated with {reports['summary']['total_count']} transactions across {len(reports['by_method'])} methods.")

    # 14. Export CSV
    req = urllib.request.Request(f"{BASE_URL}/api/payments/export?format=csv", headers=headers)
    with urllib.request.urlopen(req) as resp:
        csv_bytes = resp.read()
    print(f"✓ [Export CSV] Downloaded CSV export ({len(csv_bytes)} bytes) with UTF-8 BOM.")
    assert csv_bytes.startswith(b'\xef\xbb\xbf')

    # 15. Export Excel (.xlsx)
    req = urllib.request.Request(f"{BASE_URL}/api/payments/export?format=excel", headers=headers)
    with urllib.request.urlopen(req) as resp:
        excel_bytes = resp.read()
    print(f"✓ [Export Excel] Downloaded Excel workbook ({len(excel_bytes)} bytes).")
    assert excel_bytes.startswith(b'PK') # ZIP/XLSX header

    print("=" * 60)
    print("ALL 15 BACKEND TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
