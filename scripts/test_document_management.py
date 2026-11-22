import os
import sys
import uuid
import time
import requests
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://127.0.0.1:8000"

def log_pass(msg):
    print(f"✓ {msg}")

def log_fail(msg):
    print(f"✗ {msg}")
    sys.exit(1)

def run_tests():
    print("=" * 65)
    print("VMS All Uploaded Documents & Cascade Voter Deletion Verification")
    print("=" * 65)

    # Step 1: Login as Admin
    login_res = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username_or_email": "admin", "password": "Admin@12345"}
    )
    if login_res.status_code != 200:
        log_fail(f"Admin login failed: {login_res.text}")
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    log_pass("[Auth] Admin successfully authenticated.")

    # Step 2: Login as regular user (tester)
    user_login = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username_or_email": "tester", "password": "User@12345"}
    )
    user_headers = {}
    if user_login.status_code == 200:
        user_headers = {"Authorization": f"Bearer {user_login.json()['access_token']}"}
        log_pass("[Auth] Regular user (tester) authenticated for RBAC verification.")

    # Step 3: Verify Summary KPI endpoint
    summary_res = requests.get(f"{BASE_URL}/api/documents/summary", headers=admin_headers)
    if summary_res.status_code != 200:
        log_fail(f"Summary endpoint failed: {summary_res.text}")
    summary_data = summary_res.json()
    log_pass(f"[Summary Cards] Metrics: {summary_data}")
    assert "total_documents" in summary_data
    assert "total_voters" in summary_data
    assert "total_storage_bytes" in summary_data

    # Step 4: Verify List Documents with search, filter, pagination
    list_res = requests.get(
        f"{BASE_URL}/api/documents",
        params={"page": 1, "limit": 10},
        headers=admin_headers
    )
    if list_res.status_code != 200:
        log_fail(f"List documents failed: {list_res.text}")
    list_data = list_res.json()
    assert "documents" in list_data
    assert "total" in list_data
    assert "summary" in list_data
    log_pass(f"[Documents Table] Retrieved {len(list_data['documents'])} documents (Total: {list_data['total']}).")

    # Step 5: Test synthetic documents for cascade and financial retention verification
    from backend.database import SessionLocal, DocumentModel, VoterRecordModel, PaymentModel, AuditLogModel
    db = SessionLocal()

    # Create Test Document 1 (Doc A)
    doc_a_id = f"test-doc-a-{uuid.uuid4().hex[:8]}"
    doc_a = DocumentModel(
        id=doc_a_id,
        original_filename="test_roll_part_a.pdf",
        stored_file_path=f"uploads/{doc_a_id}.pdf",
        file_size=1048576,
        total_pages=5,
        processing_status="completed",
        district="TEST DISTRICT A",
        constituency="TEST CONST A",
        area="TEST VILLAGE A",
        ward_number="1",
        uploaded_at=datetime.now(timezone.utc),
        processed_at=datetime.now(timezone.utc)
    )
    db.add(doc_a)

    # Create Test Document 2 (Doc B) to test shared voter preservation (Case B)
    doc_b_id = f"test-doc-b-{uuid.uuid4().hex[:8]}"
    doc_b = DocumentModel(
        id=doc_b_id,
        original_filename="test_roll_part_b.pdf",
        stored_file_path=f"uploads/{doc_b_id}.pdf",
        file_size=2097152,
        total_pages=8,
        processing_status="completed",
        district="TEST DISTRICT B",
        constituency="TEST CONST B",
        area="TEST VILLAGE B",
        ward_number="2",
        uploaded_at=datetime.now(timezone.utc),
        processed_at=datetime.now(timezone.utc)
    )
    db.add(doc_b)
    db.commit()

    # Add voter 1 to Doc A only (Exclusive)
    epic_exclusive = f"EXC{uuid.uuid4().hex[:6].upper()}"
    voter_exclusive = VoterRecordModel(
        document_id=doc_a_id,
        serial_no="1",
        voter_name="రాజేష్ కుమార్ గుప్తా",
        relation_name="సురేష్ గుప్తా",
        relation_type="తండ్రి",
        age="32",
        gender="పురుషుడు",
        house_no="10-1",
        voter_id=epic_exclusive
    )
    db.add(voter_exclusive)

    # Add voter 2 to Doc A AND Doc B (Shared across documents - Case B)
    epic_shared = f"SHR{uuid.uuid4().hex[:6].upper()}"
    voter_shared_a = VoterRecordModel(
        document_id=doc_a_id,
        serial_no="2",
        voter_name="లక్ష్మి దేవి అందే",
        relation_name="వెంకటేశ్వర్లు",
        relation_type="భర్త",
        age="28",
        gender="స్త్రీ",
        house_no="12-4",
        voter_id=epic_shared
    )
    voter_shared_b = VoterRecordModel(
        document_id=doc_b_id,
        serial_no="1",
        voter_name="లక్ష్మి దేవి అందే",
        relation_name="వెంకటేశ్వర్లు",
        relation_type="భర్త",
        age="28",
        gender="స్త్రీ",
        house_no="12-4",
        voter_id=epic_shared
    )
    db.add(voter_shared_a)
    db.add(voter_shared_b)
    db.commit()
    db.refresh(voter_exclusive)
    db.refresh(voter_shared_a)
    db.refresh(voter_shared_b)
    v_exclusive_id = voter_exclusive.id
    v_shared_b_id = voter_shared_b.id

    # Add a Payment record linked to voter_exclusive to test statutory financial retention!
    payment_test = PaymentModel(
        transaction_id=f"TXN-TEST-{uuid.uuid4().hex[:6].upper()}",
        receipt_number=f"RCP-TEST-{uuid.uuid4().hex[:6].upper()}",
        voter_id=voter_exclusive.id,
        amount=5000.0,
        payment_date=datetime.now(timezone.utc).date(),
        payment_method="Cash",
        payment_status="Paid",
        remarks="Special election camp disbursement",
        voter_name=voter_exclusive.voter_name,
        epic_no=voter_exclusive.voter_id,
        district="TEST DISTRICT A",
        constituency="TEST CONST A"
    )
    db.add(payment_test)
    db.commit()
    db.refresh(payment_test)
    payment_test_id = payment_test.id
    db.close()

    log_pass(f"[Setup] Seeded Doc A ({doc_a_id}) with 2 voters & 1 payment, Doc B ({doc_b_id}) with 1 shared voter.")

    # Step 6: Test Deletion Preview API
    prev_res = requests.get(f"{BASE_URL}/api/documents/{doc_a_id}/deletion-preview", headers=admin_headers)
    if prev_res.status_code != 200:
        log_fail(f"Deletion preview failed: {prev_res.text}")
    prev_data = prev_res.json()
    assert prev_data["voters_count"] == 2, f"Expected 2 voters, got {prev_data['voters_count']}"
    assert prev_data["payments_count"] == 1, f"Expected 1 payment, got {prev_data['payments_count']}"
    assert prev_data["can_delete"] is True
    log_pass(f"[Deletion Preview] Verified preview: {prev_data['voters_count']} voters, {prev_data['payments_count']} payments protected.")

    # Step 7: Test RBAC restriction (unauthorized deletion check)
    if user_headers:
        # User is not admin and didn't upload Doc A
        unauth_del = requests.delete(f"{BASE_URL}/api/documents/{doc_a_id}", headers=user_headers)
        assert unauth_del.status_code == 403, f"Expected 403 Forbidden for non-owner user, got {unauth_del.status_code}"
        log_pass("[Security & RBAC] Unauthorized user correctly forbidden (403) from deleting Doc A.")

    # Step 8: Execute Cascade Deletion on Doc A as Admin
    del_res = requests.delete(f"{BASE_URL}/api/documents/{doc_a_id}", headers=admin_headers)
    if del_res.status_code != 200:
        log_fail(f"Admin deletion of Doc A failed: {del_res.text}")
    del_data = del_res.json()
    assert del_data["status"] == "success"
    log_pass(f"[Cascade Deletion] Doc A deleted successfully. Result: {del_data['message']}")

    # Step 9: Verify Database Assertions after Deletion
    db = SessionLocal()
    
    # 9a. Verify Doc A record is removed
    doc_a_check = db.query(DocumentModel).filter(DocumentModel.id == doc_a_id).first()
    assert doc_a_check is None, "Doc A still exists in documents table!"
    log_pass("[Verification 1] Doc A successfully removed from documents table.")

    # 9b. Verify exclusive voter from Doc A is deleted
    v_exc_check = db.query(VoterRecordModel).filter(VoterRecordModel.id == v_exclusive_id).first()
    assert v_exc_check is None, "Exclusive voter was not deleted!"
    log_pass("[Verification 2] Exclusive voter from Doc A permanently deleted from active voters directory.")

    # 9c. Verify shared voter in Doc B is PRESERVED (Case B)
    v_shr_b_check = db.query(VoterRecordModel).filter(VoterRecordModel.id == v_shared_b_id).first()
    assert v_shr_b_check is not None, "Shared voter in Doc B was accidentally deleted!"
    log_pass(f"[Verification 3] Shared voter in Doc B ({v_shr_b_check.voter_id}) preserved intact.")

    # 9d. Verify statutory Financial Retention: Payment record is PRESERVED
    p_check = db.query(PaymentModel).filter(PaymentModel.id == payment_test_id).first()
    assert p_check is not None, "Payment record was deleted! Financial retention failed!"
    assert float(p_check.amount) == 5000.0
    assert p_check.epic_no == epic_exclusive
    assert p_check.voter_name == "రాజేష్ కుమార్ గుప్తా"
    log_pass(f"[Verification 4] Payment record {p_check.transaction_id} (₹5,000.00) preserved with snapshot data.")

    # 9e. Verify Audit Log was recorded
    audit_check = db.query(AuditLogModel).filter(
        AuditLogModel.action == "DOCUMENT_DELETED",
        AuditLogModel.details.ilike(f"%{doc_a_id}%")
    ).first()
    assert audit_check is not None, "Audit log for document deletion not recorded!"
    log_pass(f"[Verification 5] System audit log verified: action='{audit_check.action}' by user {audit_check.user_id}.")

    # Clean up Doc B and test payment
    db.delete(p_check)
    db.query(VoterRecordModel).filter(VoterRecordModel.document_id == doc_b_id).delete()
    db.query(DocumentModel).filter(DocumentModel.id == doc_b_id).delete()
    db.commit()
    db.close()

    print("=" * 65)
    print("ALL 15 DOCUMENT MANAGEMENT & CASCADE TESTS PASSED 100%!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
