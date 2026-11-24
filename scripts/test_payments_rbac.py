import os
import urllib.request
import json
import urllib.parse
import sys

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

def run_rbac_tests():
    print("=" * 60)
    print("VMS Payments RBAC Authorization Test Suite")
    print("=" * 60)

    # 1. Login as Admin
    admin_login = json.dumps({"username_or_email": "admin", "password": "Admin@12345"}).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=admin_login, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        admin_token = json.loads(resp.read().decode())["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

    # 2. Check /api/rbac/my-permissions for Admin
    req = urllib.request.Request(f"{BASE_URL}/api/rbac/my-permissions", headers=admin_headers)
    with urllib.request.urlopen(req) as resp:
        my_perms = json.loads(resp.read().decode())
    print("✓ [Admin Perms] Admin has full bypass and permissions:", len(my_perms["permissions"]))
    assert "payments.view" in my_perms["permissions"]
    assert "payments.create" in my_perms["permissions"]
    assert "payments.verify" in my_perms["permissions"]
    assert "payments.cancel" in my_perms["permissions"]
    assert "payments.refund" in my_perms["permissions"]

    # 3. Create or login as tester (user / viewer role)
    user_login = json.dumps({"username_or_email": "tester", "password": "User@12345"}).encode()
    req = urllib.request.Request(f"{BASE_URL}/api/auth/login", data=user_login, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        user_token = json.loads(resp.read().decode())["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}

    # 4. Standard User / Viewer should NOT be able to delete a payment (HTTP 403 Forbidden)
    req = urllib.request.Request(f"{BASE_URL}/api/payments/1", headers=user_headers, method="DELETE")
    try:
        with urllib.request.urlopen(req) as resp:
            print("FAILED: Non-admin should not be able to delete payment!")
            sys.exit(1)
    except urllib.error.HTTPError as e:
        assert e.code == 403
        print(f"✓ [RBAC Enforcement] Standard User correctly rejected with HTTP 403 on DELETE /api/payments/1.")

    print("=" * 60)
    print("ALL RBAC AUTHORIZATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_rbac_tests()
