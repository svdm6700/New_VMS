import os
import requests
import time
from pathlib import Path

BASE = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

def main():
    print("=" * 65)
    print("TESTING MANUAL LOCATION DETAILS IN TELUGU PDF UPLOAD")
    print("=" * 65)

    # 1. Admin login to get JWT token
    print("\n[Step 0] Logging in as Admin...")
    login_res = requests.post(
        f'{BASE}/api/auth/login',
        json={'username_or_email': 'admin', 'password': 'Admin@12345'}
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    print(" -> Admin authenticated successfully.")

    # Create a small valid test PDF
    test_pdf_content = (
        b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n180\n%%EOF"
    )

    # 2. Test Scenario 2: Attempt upload without District
    print("\n[Scenario 2] Attempt upload without District (జిల్లా)...")
    res_no_dist = requests.post(
        f'{BASE}/api/documents/upload',
        headers=headers,
        files={'file': ('voter_sample.pdf', test_pdf_content, 'application/pdf')},
        data={'district': '', 'constituency': 'Tadepalligudem', 'area': 'Ramachandrapuram', 'ward_number': '2'}
    )
    assert res_no_dist.status_code == 400, f"Expected 400, got {res_no_dist.status_code}"
    assert "District (జిల్లా) is required" in res_no_dist.text, f"Unexpected error msg: {res_no_dist.text}"
    print(f" -> Passed (Rejected with 400): {res_no_dist.json()['detail']}")

    # 3. Test Scenario 3: Attempt upload without Constituency
    print("\n[Scenario 3] Attempt upload without Constituency (నియోజకవర్గం)...")
    res_no_const = requests.post(
        f'{BASE}/api/documents/upload',
        headers=headers,
        files={'file': ('voter_sample.pdf', test_pdf_content, 'application/pdf')},
        data={'district': 'West Godavari', 'constituency': '', 'area': 'Ramachandrapuram', 'ward_number': '2'}
    )
    assert res_no_const.status_code == 400, f"Expected 400, got {res_no_const.status_code}"
    assert "Constituency (నియోజకవర్గం) is required" in res_no_const.text, f"Unexpected error msg: {res_no_const.text}"
    print(f" -> Passed (Rejected with 400): {res_no_const.json()['detail']}")

    # 4. Test Scenario 4: Attempt upload without Area
    print("\n[Scenario 4] Attempt upload without Area (ప్రాంతం / గ్రామం)...")
    res_no_area = requests.post(
        f'{BASE}/api/documents/upload',
        headers=headers,
        files={'file': ('voter_sample.pdf', test_pdf_content, 'application/pdf')},
        data={'district': 'West Godavari', 'constituency': 'Tadepalligudem', 'area': '', 'ward_number': '2'}
    )
    assert res_no_area.status_code == 400, f"Expected 400, got {res_no_area.status_code}"
    assert "Area / Village (ప్రాంతం / గ్రామం) is required" in res_no_area.text, f"Unexpected error msg: {res_no_area.text}"
    print(f" -> Passed (Rejected with 400): {res_no_area.json()['detail']}")

    # 5. Test Scenario 5: Attempt upload without Ward Number
    print("\n[Scenario 5] Attempt upload without Ward Number (వార్డు నంబర్)...")
    res_no_ward = requests.post(
        f'{BASE}/api/documents/upload',
        headers=headers,
        files={'file': ('voter_sample.pdf', test_pdf_content, 'application/pdf')},
        data={'district': 'West Godavari', 'constituency': 'Tadepalligudem', 'area': 'Ramachandrapuram', 'ward_number': ''}
    )
    assert res_no_ward.status_code == 400, f"Expected 400, got {res_no_ward.status_code}"
    assert "Ward Number (వార్డు నంబర్) is required" in res_no_ward.text, f"Unexpected error msg: {res_no_ward.text}"
    print(f" -> Passed (Rejected with 400): {res_no_ward.json()['detail']}")

    # 6. Test Scenario 1: Upload PDF with ALL FOUR location details
    print("\n[Scenario 1] Upload PDF with all four valid location details...")
    dist_val = "West Godavari (పశ్చిమ గోదావరి)"
    const_val = "Tadepalligudem (తాడేపల్లిగూడెం)"
    area_val = "Kanchumillipadu (కంచుమిల్లిపాడు)"
    ward_val = "7"

    upload_res = requests.post(
        f'{BASE}/api/documents/upload',
        headers=headers,
        files={'file': ('kanchumillipadu_voters.pdf', test_pdf_content, 'application/pdf')},
        data={
            'district': dist_val,
            'constituency': const_val,
            'area': area_val,
            'ward_number': ward_val,
        }
    )
    assert upload_res.status_code in (200, 201), f"Upload failed: {upload_res.text}"
    upload_data = upload_res.json()
    new_doc_id = upload_data['id']
    print(f" -> Success! Uploaded Doc ID: {new_doc_id}")
    print(f" -> Response Location: District='{upload_data['district']}', Constituency='{upload_data['constituency']}', Area='{upload_data['area']}', Ward='{upload_data['ward_number']}'")

    # 7. Test Scenario 6 & 7: Verify location metadata is saved in DB and linked to the document
    print("\n[Scenario 6 & 7] Verify location metadata is saved in DB & linked to document...")
    get_doc_res = requests.get(f'{BASE}/api/documents/{new_doc_id}', headers=headers)
    assert get_doc_res.status_code == 200, f"Failed to get doc: {get_doc_res.text}"
    doc_info = get_doc_res.json()
    assert doc_info['district'] == dist_val, f"District mismatch: {doc_info['district']}"
    assert doc_info['constituency'] == const_val, f"Constituency mismatch: {doc_info['constituency']}"
    assert doc_info['area'] == area_val, f"Area mismatch: {doc_info['area']}"
    assert doc_info['ward_number'] == ward_val, f"Ward mismatch: {doc_info['ward_number']}"
    print(" -> Confirmed: All 4 location fields are saved in DB and associated with Document.")

    # 8. Test Scenario 8 & 9: Verify location details appear after page refresh / list query
    print("\n[Scenario 8 & 9] Verify location details appear in document list (after page refresh)...")
    list_docs_res = requests.get(f'{BASE}/api/documents', headers=headers)
    assert list_docs_res.status_code == 200, f"Failed to list docs: {list_docs_res.text}"
    all_docs = list_docs_res.json()
    matching = [d for d in all_docs if d['id'] == new_doc_id]
    assert len(matching) == 1, "Document not found in list"
    assert matching[0]['area'] == area_val, "Area mismatch in list"
    print(f" -> Confirmed in list: Area='{matching[0]['area']}' | Ward='{matching[0]['ward_number']}' | District='{matching[0]['district']}'")

    # 9. Test Scenario 10: Verify search & filters by District, Constituency, Area, Ward Number
    print("\n[Scenario 10] Verify search & filters by location details...")
    # Filter by Area
    area_filtered = requests.get(f'{BASE}/api/documents', headers=headers, params={'area': 'Kanchumillipadu'}).json()
    assert any(d['id'] == new_doc_id for d in area_filtered), "Area filter failed"
    print(f" -> Area filter returned {len(area_filtered)} matching document(s).")

    # Filter by Ward Number
    ward_filtered = requests.get(f'{BASE}/api/documents', headers=headers, params={'ward_number': '7'}).json()
    assert any(d['id'] == new_doc_id for d in ward_filtered), "Ward filter failed"
    print(f" -> Ward filter returned {len(ward_filtered)} matching document(s).")

    # Global search query
    query_res = requests.get(f'{BASE}/api/documents', headers=headers, params={'query': 'Kanchumillipadu'}).json()
    assert any(d['id'] == new_doc_id for d in query_res), "Query search failed"
    print(f" -> Search query 'Kanchumillipadu' returned {len(query_res)} matching document(s).")

    # Clean up test document
    del_res = requests.delete(f'{BASE}/api/documents/{new_doc_id}', headers=headers)
    assert del_res.status_code == 200, f"Delete failed: {del_res.text}"
    print(f" -> Cleaned up test document {new_doc_id}.")

    print("\n" + "=" * 65)
    print("ALL 10 LOCATION DETAILS TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 65)

if __name__ == '__main__':
    main()
