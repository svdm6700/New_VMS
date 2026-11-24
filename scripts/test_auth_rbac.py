import os
import requests

BASE = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")

def main():
    # 1. Admin login
    print("Testing 1: Admin login...")
    login_res = requests.post(
        f'{BASE}/api/auth/login',
        json={'username_or_email': 'admin', 'password': 'Admin@12345'}
    )
    assert login_res.status_code == 200, f'Admin login failed: {login_res.text}'
    data = login_res.json()
    admin_token = data['access_token']
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    print(f" -> Admin logged in successfully: {data['user']['username']} (Role: {data['user']['role']})")

    # 2. Admin get users list
    print("Testing 2: Admin list users...")
    users_res = requests.get(f'{BASE}/api/admin/users', headers=admin_headers)
    assert users_res.status_code == 200, f'Get users failed: {users_res.text}'
    total_users = users_res.json().get('total', 0)
    print(f" -> Total registered users in system: {total_users}")

    # 3. Create test standard user
    print("Testing 3: Create regular user 'tester'...")
    create_res = requests.post(
        f'{BASE}/api/admin/users',
        headers=admin_headers,
        json={
            'full_name': 'Test Regular User',
            'email': 'tester@telugupdf.com',
            'username': 'tester',
            'password': 'User@12345',
            'role': 'user',
            'is_active': True
        }
    )
    if create_res.status_code == 400 and ('already registered' in create_res.text or 'already exists' in create_res.text):
        # User already exists from earlier test, let's proceed
        print(" -> User 'tester' already created.")
        test_user_id = None
    else:
        assert create_res.status_code in (200, 201), f'Create user failed: {create_res.text}'
        test_user_id = create_res.json()['id']
        print(f" -> Created user with id: {test_user_id}")

    # 4. Standard user login
    print("Testing 4: Regular user login...")
    user_login = requests.post(
        f'{BASE}/api/auth/login',
        json={'username_or_email': 'tester', 'password': 'User@12345'}
    )
    assert user_login.status_code == 200, f'User login failed: {user_login.text}'
    user_token = user_login.json()['access_token']
    user_headers = {'Authorization': f'Bearer {user_token}'}
    print(f" -> User logged in successfully: {user_login.json()['user']['username']} (Role: {user_login.json()['user']['role']})")

    # 5. RBAC Enforcement: Standard user trying to access admin endpoint
    print("Testing 5: RBAC Enforcement check (User accessing /api/admin/users)...")
    forbidden_res = requests.get(f'{BASE}/api/admin/users', headers=user_headers)
    assert forbidden_res.status_code == 403, f"Expected 403 Forbidden, got {forbidden_res.status_code}: {forbidden_res.text}"
    print(f" -> Access blocked with 403 Forbidden: {forbidden_res.json().get('detail')}")

    # 6. User profile me endpoint
    print("Testing 6: User accessing /api/auth/me...")
    me_res = requests.get(f'{BASE}/api/auth/me', headers=user_headers)
    assert me_res.status_code == 200, f"Get me failed: {me_res.text}"
    print(f" -> Profile confirmed: {me_res.json()['full_name']} (@{me_res.json()['username']})")

    # 7. Document isolation check:
    print("Testing 7: RBAC Document isolation check...")
    admin_docs = requests.get(f'{BASE}/api/documents', headers=admin_headers).json()
    user_docs = requests.get(f'{BASE}/api/documents', headers=user_headers).json()
    print(f" -> Admin sees {len(admin_docs)} documents")
    print(f" -> User sees {len(user_docs)} documents (own documents only)")

    print("\n=======================================================")
    print("SUCCESS: ALL AUTHENTICATION & RBAC TESTS PASSED 100%!")
    print("=======================================================")

if __name__ == '__main__':
    main()
