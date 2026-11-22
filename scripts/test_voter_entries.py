import sys
import requests
from datetime import date

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=" * 65)
    print("TESTING VMS - VOTER DETAILS & AMOUNT ENTRY MANAGEMENT")
    print("=" * 65)

    # 1. Login as Admin
    print("\n[Step 1] Authenticating as Admin...")
    login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username_or_email": "admin",
        "password": "Admin@12345"
    })
    assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(" -> Admin authenticated successfully.")

    # 2. Search Voter by EPIC ID
    print("\n[Step 2] Searching voters by partial EPIC ID ('SJC')...")
    search_res = requests.get(f"{BASE_URL}/api/voters/search?q=SJC&limit=5")
    assert search_res.status_code == 200
    voters = search_res.json().get("voters", [])
    assert len(voters) > 0, "No voters found with 'SJC'"
    selected_voter = voters[0]
    print(f" -> Found {search_res.json()['total']} matching voters.")
    print(f" -> Selected Voter: ID={selected_voter['id']}, Name='{selected_voter['voter_name']}', EPIC='{selected_voter['voter_id']}'")

    # 3. Search Voter by Partial Name
    print("\n[Step 3] Searching voters by partial Telugu name...")
    name_search = requests.get(f"{BASE_URL}/api/voters/search?q=వెంకట&limit=5")
    assert name_search.status_code == 200
    print(f" -> Search by 'వెంకట' returned {name_search.json()['total']} results.")

    # 4. Fetch Complete Voter Details
    print(f"\n[Step 4] Fetching complete details for voter {selected_voter['id']}...")
    detail_res = requests.get(f"{BASE_URL}/api/voters/{selected_voter['id']}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["voter_id"] == selected_voter["voter_id"]
    print(f" -> Confirmed details: House={detail['house_no']}, Relation={detail['relation_name']} ({detail['relation_type']}), Area={detail['area']}, Ward={detail['ward_number']}")

    # 5. Validation Check: Invalid mobile number (< 10 digits)
    print("\n[Step 5] Testing validation: invalid mobile number (8 digits)...")
    bad_mob_res = requests.post(f"{BASE_URL}/api/voter-entries", headers=admin_headers, json={
        "voter_id": selected_voter["id"],
        "mobile_number": "98765432",
        "amount": 2500.00
    })
    assert bad_mob_res.status_code == 400
    print(f" -> Passed (Rejected with 400): {bad_mob_res.json()['detail']}")

    # 6. Validation Check: Invalid amount (negative or 0)
    print("\n[Step 6] Testing validation: invalid amount (-500)...")
    bad_amt_res = requests.post(f"{BASE_URL}/api/voter-entries", headers=admin_headers, json={
        "voter_id": selected_voter["id"],
        "mobile_number": "9876543210",
        "amount": -500.00
    })
    assert bad_amt_res.status_code == 400
    print(f" -> Passed (Rejected with 400): {bad_amt_res.json()['detail']}")

    # 7. Create Valid Entry
    print("\n[Step 7] Creating valid entry (Mobile: 9848012345, Amount: ₹3,500.00)...")
    create_res = requests.post(f"{BASE_URL}/api/voter-entries", headers=admin_headers, json={
        "voter_id": selected_voter["id"],
        "mobile_number": "9848012345",
        "amount": 3500.00,
        "entry_date": str(date.today()),
        "remarks": "Welfare disbursement verification"
    })
    assert create_res.status_code == 201, f"Create entry failed: {create_res.text}"
    entry_data = create_res.json()["entry"]
    entry_id = entry_data["id"]
    print(f" -> Entry created successfully! Entry ID={entry_id}, Amount=₹{entry_data['amount']}, Mobile={entry_data['mobile_number']}")

    # 8. Duplicate Submission Check
    print("\n[Step 8] Testing duplicate entry protection (immediate resubmit)...")
    dup_res = requests.post(f"{BASE_URL}/api/voter-entries", headers=admin_headers, json={
        "voter_id": selected_voter["id"],
        "mobile_number": "9848012345",
        "amount": 3500.00
    })
    assert dup_res.status_code == 409
    print(f" -> Passed (Rejected duplicate with 409): {dup_res.json()['detail']}")

    # 9. Search Voter by Mobile Number
    print("\n[Step 9] Searching voters by recorded mobile number '9848012345'...")
    mob_search = requests.get(f"{BASE_URL}/api/voters/search?q=9848012345")
    assert mob_search.status_code == 200
    found_by_mob = any(v["id"] == selected_voter["id"] for v in mob_search.json().get("voters", []))
    assert found_by_mob, "Voter was not found by mobile number search"
    print(" -> Confirmed: Voter found via mobile number search!")

    # 10. Fetch Previous Entries History
    print(f"\n[Step 10] Fetching entries history for voter {selected_voter['id']}...")
    history_res = requests.get(f"{BASE_URL}/api/voters/{selected_voter['id']}/entries")
    assert history_res.status_code == 200
    history = history_res.json()
    assert history["total_entries"] >= 1
    print(f" -> Voter has {history['total_entries']} recorded entry(ies). Total amount: ₹{history['total_amount']}")

    # 11. Update Entry
    print(f"\n[Step 11] Updating entry {entry_id} (New Amount: ₹4,200.00)...")
    update_res = requests.put(f"{BASE_URL}/api/voter-entries/{entry_id}", headers=admin_headers, json={
        "amount": 4200.00,
        "remarks": "Updated grant amount after review"
    })
    assert update_res.status_code == 200
    assert update_res.json()["entry"]["amount"] == 4200.00
    print(f" -> Entry updated successfully: Amount=₹{update_res.json()['entry']['amount']}")

    # 12. Delete Entry
    print(f"\n[Step 12] Deleting test entry {entry_id}...")
    del_res = requests.delete(f"{BASE_URL}/api/voter-entries/{entry_id}", headers=admin_headers)
    assert del_res.status_code == 200
    print(f" -> Entry {entry_id} deleted successfully.")

    print("\n" + "=" * 65)
    print("SUCCESS: ALL 12 VOTER ENTRY TESTS PASSED 100%!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
