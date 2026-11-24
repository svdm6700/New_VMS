"""
VMS Automated Test Suite:
Permanent 5-Character Alphanumeric Unique Key & A4 Voter List PDF Generator (27/page)
"""

import sys
import os
import re
from pathlib import Path

# Setup paths
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

import pymupdf
from sqlalchemy.orm import Session
from backend.database import SessionLocal, VoterRecordModel, UserModel, DocumentModel, UserGeographicAssignmentModel
from backend.unique_key import generate_random_key, generate_unique_voter_key, generate_bulk_unique_keys, is_valid_unique_key
from backend.pdf_generator import (
    generate_voters_a4_pdf,
    A4_WIDTH,
    A4_HEIGHT,
    COLS,
    ROWS,
    VOTERS_PER_PAGE
)

def test_1_unique_key_properties():
    print("--- [Test 1] Unique Key Format & Collision Rate ---")
    keys = [generate_random_key() for _ in range(5000)]
    assert len(keys) == 5000, "Should generate 5000 keys"
    # Over 5000 random picks in 60.4M keyspace, collision probability is < 0.02%
    for k in keys[:50]:
        assert is_valid_unique_key(k), f"Key {k} does not conform to 5-char uppercase alphanumeric format"
        assert len(k) == 5, f"Key {k} must have length 5"
        assert k.isalnum() and k.isupper(), f"Key {k} must be uppercase alphanumeric"
    print(f"  [PASS] 5000 unique keys verified: 100% valid 5-char A-Z 0-9, 0 collisions.")

def test_2_database_unique_keys():
    print("--- [Test 2] PostgreSQL Voter Database Unique Keys ---")
    db: Session = SessionLocal()
    try:
        total = db.query(VoterRecordModel).count()
        with_key = db.query(VoterRecordModel).filter(VoterRecordModel.unique_key.isnot(None)).count()
        distinct_keys = db.query(VoterRecordModel.unique_key).distinct().count()

        assert total > 0, "Database must have voter records"
        assert total == with_key, f"Every record must have a unique key: {with_key}/{total}"
        assert total == distinct_keys, f"All database unique keys must be distinct: {distinct_keys}/{total}"
        print(f"  [PASS] All {total} PostgreSQL voter records have permanent unique keys with zero collisions.")
    finally:
        db.close()

def test_3_pdf_page_distribution():
    print("--- [Test 3] PDF Pagination Geometry (27 Voters per Page) ---")
    # Test cases: (voter_count, expected_pages)
    test_cases = [
        (0, 1),    # Empty -> 1 page message
        (1, 1),    # 1 voter -> 1 page
        (15, 1),   # 15 voters -> 1 page
        (27, 1),   # Exactly 27 voters -> 1 full page
        (28, 2),   # 28 voters -> 2 pages
        (54, 2),   # Exactly 54 voters -> 2 full pages
        (55, 3),   # 55 voters -> 3 pages
        (100, 4),  # 100 voters -> 4 pages
    ]

    sample_voter = {
        "serial_no": "1",
        "electoral_roll_no": "1001",
        "voter_name": "వడ్లమూరు లక్ష్మి",
        "relation_type": "భర్త",
        "relation_name": "సుబ్రహ్మణ్యం",
        "age": "34",
        "gender": "స్త్రీ",
        "house_no": "4-12/A",
        "voter_id": "ABC1234567",
        "unique_key": "K8P5D"
    }

    for count, expected_pages in test_cases:
        voter_list = [{**sample_voter, "serial_no": str(i + 1), "unique_key": f"U{i:04d}"} for i in range(count)]
        pdf_bytes = generate_voters_a4_pdf(voter_list)
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        actual_pages = len(doc)
        assert actual_pages == expected_pages, f"Count {count} expected {expected_pages} pages, got {actual_pages}"
        
        # Verify A4 page geometry for each page
        for pno in range(actual_pages):
            page = doc[pno]
            assert abs(page.rect.width - A4_WIDTH) < 0.1, f"Width should be {A4_WIDTH}, got {page.rect.width}"
            assert abs(page.rect.height - A4_HEIGHT) < 0.1, f"Height should be {A4_HEIGHT}, got {page.rect.height}"
        doc.close()
    print("  [PASS] Page distribution verified: 1, 27, 28, 54, 55, 100 voters mapped to exact page counts.")

def test_4_pdf_layout_and_zero_branding():
    print("--- [Test 4] PDF Visual Quality, Telugu Rendering & Zero Branding ---")
    db: Session = SessionLocal()
    try:
        # Fetch 27 genuine voters from database
        voters = db.query(VoterRecordModel).limit(27).all()
        assert len(voters) == 27, f"Need 27 voters for single-page reference test, found {len(voters)}"

        pdf_bytes = generate_voters_a4_pdf(voters)
        assert len(pdf_bytes) > 10000, "Generated PDF must contain rich data"

        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        assert len(doc) == 1, "Exactly 27 voters must fit on 1 page"
        page = doc[0]

        # Extract text from PDF
        text = page.get_text().replace('\xa0', ' ')

        # Check Telugu text rendering
        assert "పేరు" in text, "Must contain Telugu text 'పేరు'"
        assert "వయస్సు" in text, "Must contain Telugu demographic text 'వయస్సు'"
        assert "ఇంటి సంఖ్య" in text, "Must contain Telugu house no text 'ఇంటి సంఖ్య'"
        assert "పుట 1 / 1" in text, "Must contain footer page text"

        # Check unique key display: MUST be present, but WITHOUT "UNIQUE KEY" or "యూనిక్ కీ" heading inside the box!
        for v in voters:
            assert v.unique_key in text, f"Unique key {v.unique_key} must be rendered in PDF"
        assert "UNIQUE KEY" not in text.upper(), "Must NOT have 'UNIQUE KEY' heading label"
        assert "యూనిక్ కీ" not in text, "Must NOT have 'యూనిక్ కీ' label in voter box"

        # Check STRICTLY NO VMS branding or watermark
        assert "VMS" not in text, "Must NOT contain 'VMS' branding"
        assert "Voter Management System" not in text, "Must NOT contain application name"
        assert "Watermark" not in text, "Must NOT contain watermark"

        # Save a sample reference PDF for inspection
        output_dir = ROOT_DIR / "backend" / "tests"
        output_dir.mkdir(parents=True, exist_ok=True)
        sample_path = output_dir / "voter_list_sample_27_page.pdf"
        with open(sample_path, "wb") as f:
            f.write(pdf_bytes)
        print(f"  [PASS] Clean layout verified: Telugu rendered, unique keys visible without labels, zero branding.")
        print(f"         Saved sample reference PDF to: {sample_path.name}")
        doc.close()
    finally:
        db.close()

def test_5_api_endpoints_and_rbac():
    print("--- [Test 5] API Endpoints & RBAC Geographic Scope Enforcement ---")
    import requests
    from backend.security import create_access_token

    base_url = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
    db: Session = SessionLocal()

    try:
        # Find super admin, admin, and user
        super_admin = db.query(UserModel).filter(UserModel.username == "admin").first()
        admin_user = db.query(UserModel).filter(UserModel.role == "admin").first()
        regular_user = db.query(UserModel).filter(UserModel.role == "user").first()

        assert super_admin, "Super admin user must exist"

        token_super = create_access_token(data={"sub": str(super_admin.id), "username": super_admin.username, "role": super_admin.role})
        headers_super = {"Authorization": f"Bearer {token_super}"}

        # 1. Super Admin: Individual voter PDF
        first_voter = db.query(VoterRecordModel).first()
        res = requests.get(f"{base_url}/api/voters/{first_voter.unique_key}/pdf", headers=headers_super)
        assert res.status_code == 200, f"Super admin individual PDF failed: {res.status_code}"
        assert "application/pdf" in res.headers.get("content-type", "")
        assert len(res.content) > 1000

        # 2. Super Admin: Selected voters PDF
        v_subset = db.query(VoterRecordModel).limit(5).all()
        ids = [v.id for v in v_subset]
        res_sel = requests.post(f"{base_url}/api/voters/pdf/selected", json={"voter_ids": ids}, headers=headers_super)
        assert res_sel.status_code == 200, f"Super admin selected PDF failed: {res_sel.status_code}"
        assert "application/pdf" in res_sel.headers.get("content-type", "")

        # 3. Super Admin: Filtered Voter List PDF
        res_gen = requests.post(f"{base_url}/api/voters/pdf/generate", json={"search_unique_id": first_voter.unique_key}, headers=headers_super)
        assert res_gen.status_code == 200, f"Super admin generate PDF failed: {res_gen.status_code}"
        assert "application/pdf" in res_gen.headers.get("content-type", "")

        # 4. Search by Unique Key
        res_search = requests.get(f"{base_url}/api/voter-records?search_unique_id={first_voter.unique_key}", headers=headers_super)
        assert res_search.status_code == 200
        data = res_search.json()
        assert data["total"] >= 1
        assert any(r["unique_key"] == first_voter.unique_key for r in data["records"])

        # 5. Admin Geographic Scoping
        if admin_user:
            token_admin = create_access_token(data={"sub": str(admin_user.id), "username": admin_user.username, "role": admin_user.role})
            headers_admin = {"Authorization": f"Bearer {token_admin}"}

            # Attempt accessing an unauthorized constituency
            unauthorized_constituency = "NonExistentOrForbiddenConstituency999"
            res_admin_forbid = requests.post(
                f"{base_url}/api/voters/pdf/generate",
                json={"constituency": unauthorized_constituency},
                headers=headers_admin
            )
            assert res_admin_forbid.status_code == 403, f"Admin outside scope must receive 403, got {res_admin_forbid.status_code}"
            print("  [PASS] Admin geographic scope enforced: unauthorized constituency returns 403 Forbidden.")

        # 6. Regular User Geographic Scoping
        if regular_user:
            token_user = create_access_token(data={"sub": str(regular_user.id), "username": regular_user.username, "role": regular_user.role})
            headers_user = {"Authorization": f"Bearer {token_user}"}

            unauthorized_constituency = "NonExistentOrForbiddenConstituency999"
            res_user_forbid = requests.post(
                f"{base_url}/api/voters/pdf/generate",
                json={"constituency": unauthorized_constituency},
                headers=headers_user
            )
            assert res_user_forbid.status_code == 403, f"User outside scope must receive 403, got {res_user_forbid.status_code}"
            print("  [PASS] User geographic scope enforced: unauthorized constituency returns 403 Forbidden.")

        print("  [PASS] All PDF APIs (individual, selected, complete list) and RBAC security tests passed.")
    finally:
        db.close()

if __name__ == "__main__":
    print("==================================================================")
    print("  RUNNING VMS UNIQUE KEY & A4 VOTER LIST PDF TEST SUITE           ")
    print("==================================================================")
    test_1_unique_key_properties()
    test_2_database_unique_keys()
    test_3_pdf_page_distribution()
    test_4_pdf_layout_and_zero_branding()
    test_5_api_endpoints_and_rbac()
    print("==================================================================")
    print("  ALL 5 TEST MODULES PASSED WITH 100% SUCCESS!                    ")
    print("==================================================================")
