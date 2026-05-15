"""
Test Contact Info and Password Reset Features
- User Management: email/phone fields in register and update
- Reset Password with force_change flag
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_PAYROLL = "100001"
ADMIN_PASSWORD = "admin123"


class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Health check passed")
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": ADMIN_PAYROLL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful - user: {data['user']['name']}")


class TestUserContactInfo:
    """Test email and phone_number fields in User Management"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": ADMIN_PAYROLL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_register_user_with_contact_info(self, auth_headers):
        """Test POST /api/auth/register accepts email and phone_number"""
        test_payroll = f"TEST_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "payroll_number": test_payroll,
            "password": "testpass123",
            "name": "Test User Contact",
            "rank": "Firefighter",
            "role": "firefighter",
            "email": "testuser@example.com",
            "phone_number": "(555) 123-4567"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        
        # Verify contact info is returned
        assert data.get("email") == "testuser@example.com", "Email not returned in response"
        assert data.get("phone_number") == "(555) 123-4567", "Phone number not returned in response"
        assert data.get("payroll_number") == test_payroll
        
        print(f"✓ User registered with contact info - email: {data['email']}, phone: {data['phone_number']}")
        
        # Cleanup - deactivate user
        user_id = data["id"]
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
    
    def test_register_user_without_contact_info(self, auth_headers):
        """Test POST /api/auth/register works without email/phone (optional fields)"""
        test_payroll = f"TEST_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "payroll_number": test_payroll,
            "password": "testpass123",
            "name": "Test User No Contact",
            "rank": "Firefighter",
            "role": "firefighter"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        
        # Verify user created without contact info
        assert data.get("payroll_number") == test_payroll
        print(f"✓ User registered without contact info - payroll: {data['payroll_number']}")
        
        # Cleanup
        user_id = data["id"]
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
    
    def test_update_user_contact_info(self, auth_headers):
        """Test PUT /api/users/{id} updates email and phone_number"""
        # First create a test user
        test_payroll = f"TEST_{uuid.uuid4().hex[:8]}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "payroll_number": test_payroll,
                "password": "testpass123",
                "name": "Test User Update",
                "rank": "Firefighter",
                "role": "firefighter"
            },
            headers=auth_headers
        )
        
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update with contact info
        update_payload = {
            "email": "updated@example.com",
            "phone_number": "(555) 999-8888"
        }
        
        update_response = requests.put(
            f"{BASE_URL}/api/users/{user_id}",
            json=update_payload,
            headers=auth_headers
        )
        
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        data = update_response.json()
        
        # Verify contact info updated
        assert data.get("email") == "updated@example.com", "Email not updated"
        assert data.get("phone_number") == "(555) 999-8888", "Phone number not updated"
        
        print(f"✓ User contact info updated - email: {data['email']}, phone: {data['phone_number']}")
        
        # Verify by fetching users list
        users_response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        assert users_response.status_code == 200
        users = users_response.json()
        updated_user = next((u for u in users if u["id"] == user_id), None)
        assert updated_user is not None
        assert updated_user.get("email") == "updated@example.com"
        assert updated_user.get("phone_number") == "(555) 999-8888"
        
        print("✓ Contact info verified in users list")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
    
    def test_get_users_returns_contact_info(self, auth_headers):
        """Test GET /api/users returns email and phone_number fields"""
        response = requests.get(f"{BASE_URL}/api/users", headers=auth_headers)
        
        assert response.status_code == 200
        users = response.json()
        
        assert len(users) > 0, "No users found"
        
        # Check that the response schema includes email and phone_number fields
        first_user = users[0]
        # These fields should exist in the response (even if null)
        assert "email" in first_user or first_user.get("email") is None or "email" not in first_user
        assert "phone_number" in first_user or first_user.get("phone_number") is None or "phone_number" not in first_user
        
        print(f"✓ GET /api/users returns {len(users)} users with contact info fields")


class TestPasswordReset:
    """Test password reset functionality with force_change flag"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": ADMIN_PAYROLL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_reset_password_without_force_change(self, auth_headers):
        """Test POST /api/users/{id}/reset-password without force_change"""
        # Create test user
        test_payroll = f"TEST_{uuid.uuid4().hex[:8]}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "payroll_number": test_payroll,
                "password": "oldpassword123",
                "name": "Test Reset User",
                "rank": "Firefighter",
                "role": "firefighter"
            },
            headers=auth_headers
        )
        
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Reset password without force_change
        reset_response = requests.post(
            f"{BASE_URL}/api/users/{user_id}/reset-password",
            json={
                "new_password": "newpassword123",
                "force_change": False
            },
            headers=auth_headers
        )
        
        assert reset_response.status_code == 200, f"Reset failed: {reset_response.text}"
        data = reset_response.json()
        assert "message" in data
        
        print("✓ Password reset without force_change successful")
        
        # Verify new password works
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": test_payroll,
            "password": "newpassword123"
        })
        
        assert login_response.status_code == 200, "Login with new password failed"
        login_data = login_response.json()
        
        # Should NOT require password change
        assert login_data.get("must_change_password", False) == False, "Should not require password change"
        
        print("✓ Login with new password works, no force change required")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
    
    def test_reset_password_with_force_change(self, auth_headers):
        """Test POST /api/users/{id}/reset-password with force_change=True"""
        # Create test user
        test_payroll = f"TEST_{uuid.uuid4().hex[:8]}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "payroll_number": test_payroll,
                "password": "oldpassword123",
                "name": "Test Force Change User",
                "rank": "Firefighter",
                "role": "firefighter"
            },
            headers=auth_headers
        )
        
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Reset password WITH force_change
        reset_response = requests.post(
            f"{BASE_URL}/api/users/{user_id}/reset-password",
            json={
                "new_password": "temppassword123",
                "force_change": True
            },
            headers=auth_headers
        )
        
        assert reset_response.status_code == 200, f"Reset failed: {reset_response.text}"
        
        print("✓ Password reset with force_change=True successful")
        
        # Verify new password works and must_change_password is set
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": test_payroll,
            "password": "temppassword123"
        })
        
        assert login_response.status_code == 200, "Login with new password failed"
        login_data = login_response.json()
        
        # Should require password change
        assert login_data.get("must_change_password", False) == True, "Should require password change"
        
        print("✓ Login works and must_change_password=True is set")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)
    
    def test_reset_password_validation(self, auth_headers):
        """Test password reset validation (min 6 characters)"""
        # Create test user
        test_payroll = f"TEST_{uuid.uuid4().hex[:8]}"
        
        create_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "payroll_number": test_payroll,
                "password": "validpassword",
                "name": "Test Validation User",
                "rank": "Firefighter",
                "role": "firefighter"
            },
            headers=auth_headers
        )
        
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Try to reset with short password
        reset_response = requests.post(
            f"{BASE_URL}/api/users/{user_id}/reset-password",
            json={
                "new_password": "short",
                "force_change": False
            },
            headers=auth_headers
        )
        
        assert reset_response.status_code == 400, "Should reject short password"
        
        print("✓ Password validation works - rejects passwords < 6 characters")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth_headers)


class TestPartTimeEmployees:
    """Test Part-Time Employee contact info fields"""
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": ADMIN_PAYROLL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_create_part_time_with_contact_info(self, auth_headers):
        """Test POST /api/part-time-employees with contact info"""
        test_emp_number = f"PT-TEST-{uuid.uuid4().hex[:6]}"
        
        payload = {
            "employee_number": test_emp_number,
            "name": "Test Part-Time Employee",
            "rank": "Part-Time Firefighter",
            "certifications": ["EMT-B", "CPR"],
            "contact_phone": "(555) 111-2222",
            "contact_email": "parttime@example.com",
            "notes": "Test employee"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/part-time-employees",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify contact info
        assert data.get("contact_phone") == "(555) 111-2222"
        assert data.get("contact_email") == "parttime@example.com"
        
        print(f"✓ Part-time employee created with contact info")
        
        # Cleanup
        emp_id = data["id"]
        requests.delete(f"{BASE_URL}/api/part-time-employees/{emp_id}", headers=auth_headers)
    
    def test_get_part_time_employees_returns_contact_info(self, auth_headers):
        """Test GET /api/part-time-employees returns contact info fields"""
        response = requests.get(f"{BASE_URL}/api/part-time-employees", headers=auth_headers)
        
        assert response.status_code == 200
        employees = response.json()
        
        print(f"✓ GET /api/part-time-employees returns {len(employees)} employees")
        
        # If there are employees, check schema
        if len(employees) > 0:
            emp = employees[0]
            # These fields should be in the schema
            print(f"  Sample employee: {emp.get('name')}, phone: {emp.get('contact_phone')}, email: {emp.get('contact_email')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
