"""
Test suite for Personnel Management and Temporary Password features
- Edit Personnel with payroll_number updates
- Set temporary password for personnel
- Change password flow with must_change_password flag
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_PAYROLL = "100001"
ADMIN_PASSWORD = "admin123"

class TestAuthAndHealth:
    """Basic health and auth tests"""
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
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
        assert data["user"]["payroll_number"] == ADMIN_PAYROLL
        assert data["user"]["role"] == "admin"
        print("✓ Admin login passed")


class TestPersonnelPayrollUpdate:
    """Test editing personnel payroll number"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": ADMIN_PAYROLL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def auth_headers(self, admin_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_get_personnel_list(self, auth_headers):
        """Test getting personnel list"""
        response = requests.get(f"{BASE_URL}/api/personnel", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Got {len(data)} personnel records")
    
    def test_update_personnel_payroll_number(self, auth_headers):
        """Test updating personnel payroll number - key feature test"""
        # First get a personnel record
        response = requests.get(f"{BASE_URL}/api/personnel", headers=auth_headers)
        assert response.status_code == 200
        personnel = response.json()
        assert len(personnel) > 0
        
        # Pick a test personnel (not the first one to avoid conflicts)
        test_person = personnel[5] if len(personnel) > 5 else personnel[0]
        original_payroll = test_person["payroll_number"]
        
        # Generate a unique test payroll number
        test_payroll = f"TEST_{uuid.uuid4().hex[:6]}"
        
        # Update the payroll number
        update_response = requests.put(
            f"{BASE_URL}/api/personnel/{test_person['id']}", 
            headers=auth_headers,
            json={"payroll_number": test_payroll}
        )
        assert update_response.status_code == 200
        updated_person = update_response.json()
        assert updated_person["payroll_number"] == test_payroll
        print(f"✓ Updated payroll number from {original_payroll} to {test_payroll}")
        
        # Verify the update persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/personnel/{test_person['id']}", 
            headers=auth_headers
        )
        assert verify_response.status_code == 200
        verified_person = verify_response.json()
        assert verified_person["payroll_number"] == test_payroll
        print("✓ Verified payroll number update persisted")
        
        # Restore original payroll number
        restore_response = requests.put(
            f"{BASE_URL}/api/personnel/{test_person['id']}", 
            headers=auth_headers,
            json={"payroll_number": original_payroll}
        )
        assert restore_response.status_code == 200
        print(f"✓ Restored original payroll number: {original_payroll}")


class TestTemporaryPassword:
    """Test temporary password feature"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": ADMIN_PAYROLL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def auth_headers(self, admin_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_set_temporary_password_creates_user(self, auth_headers):
        """Test setting temporary password creates user with must_change_password=true"""
        # Get a personnel record that doesn't have a user account
        response = requests.get(f"{BASE_URL}/api/personnel", headers=auth_headers)
        assert response.status_code == 200
        personnel = response.json()
        
        # Find a personnel without existing user (use one with payroll > 200010)
        test_person = None
        for p in personnel:
            if p["payroll_number"].startswith("200") and int(p["payroll_number"]) > 200010:
                test_person = p
                break
        
        if not test_person:
            pytest.skip("No suitable test personnel found")
        
        temp_password = "temppass123"
        
        # Set temporary password
        set_pwd_response = requests.post(
            f"{BASE_URL}/api/auth/set-temporary-password",
            headers=auth_headers,
            json={
                "personnel_id": test_person["id"],
                "temporary_password": temp_password
            }
        )
        assert set_pwd_response.status_code == 200
        result = set_pwd_response.json()
        assert "message" in result
        print(f"✓ Set temporary password for {test_person['name']}: {result['message']}")
        
        # Try to login with the temp password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": test_person["payroll_number"],
            "password": temp_password
        })
        assert login_response.status_code == 200
        login_data = login_response.json()
        
        # Verify must_change_password is true
        assert login_data.get("must_change_password") == True
        assert login_data["user"].get("must_change_password") == True
        print(f"✓ Login successful with must_change_password=true")
        
        return {
            "payroll_number": test_person["payroll_number"],
            "temp_password": temp_password,
            "token": login_data["access_token"]
        }
    
    def test_change_password_clears_flag(self, auth_headers):
        """Test that changing password clears must_change_password flag"""
        # Get a personnel record
        response = requests.get(f"{BASE_URL}/api/personnel", headers=auth_headers)
        personnel = response.json()
        
        # Find a test personnel
        test_person = None
        for p in personnel:
            if p["payroll_number"].startswith("200") and int(p["payroll_number"]) > 200020:
                test_person = p
                break
        
        if not test_person:
            pytest.skip("No suitable test personnel found")
        
        temp_password = "temppass456"
        new_password = "newpass789"
        
        # Set temporary password
        set_pwd_response = requests.post(
            f"{BASE_URL}/api/auth/set-temporary-password",
            headers=auth_headers,
            json={
                "personnel_id": test_person["id"],
                "temporary_password": temp_password
            }
        )
        assert set_pwd_response.status_code == 200
        print(f"✓ Set temporary password for {test_person['name']}")
        
        # Login with temp password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": test_person["payroll_number"],
            "password": temp_password
        })
        assert login_response.status_code == 200
        user_token = login_response.json()["access_token"]
        assert login_response.json().get("must_change_password") == True
        print("✓ Logged in with must_change_password=true")
        
        # Change password
        change_pwd_response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "current_password": temp_password,
                "new_password": new_password
            }
        )
        assert change_pwd_response.status_code == 200
        print("✓ Password changed successfully")
        
        # Login again with new password
        new_login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": test_person["payroll_number"],
            "password": new_password
        })
        assert new_login_response.status_code == 200
        new_login_data = new_login_response.json()
        
        # Verify must_change_password is now false
        assert new_login_data.get("must_change_password") == False
        print("✓ must_change_password flag cleared after password change")
    
    def test_set_temporary_password_requires_admin(self):
        """Test that non-admin cannot set temporary password"""
        # Login as BC (non-admin)
        bc_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": "100002",
            "password": "bc123"
        })
        
        if bc_login.status_code != 200:
            pytest.skip("BC login failed")
        
        bc_token = bc_login.json()["access_token"]
        
        # Try to set temporary password
        response = requests.post(
            f"{BASE_URL}/api/auth/set-temporary-password",
            headers={"Authorization": f"Bearer {bc_token}"},
            json={
                "personnel_id": "some-id",
                "temporary_password": "test123"
            }
        )
        assert response.status_code == 403
        print("✓ Non-admin correctly denied access to set-temporary-password")
    
    def test_set_temporary_password_invalid_personnel(self, auth_headers):
        """Test setting password for non-existent personnel"""
        response = requests.post(
            f"{BASE_URL}/api/auth/set-temporary-password",
            headers=auth_headers,
            json={
                "personnel_id": "non-existent-id",
                "temporary_password": "test123"
            }
        )
        assert response.status_code == 404
        print("✓ Correctly returns 404 for non-existent personnel")


class TestChangePasswordValidation:
    """Test change password validation"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": ADMIN_PAYROLL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    def test_change_password_wrong_current(self, admin_token):
        """Test change password with wrong current password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123"
            }
        )
        assert response.status_code == 400
        assert "incorrect" in response.json().get("detail", "").lower()
        print("✓ Correctly rejects wrong current password")


class TestPersonnelUpdateModel:
    """Test PersonnelUpdate model accepts payroll_number"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "payroll_number": ADMIN_PAYROLL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def auth_headers(self, admin_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {admin_token}"}
    
    def test_update_multiple_fields_including_payroll(self, auth_headers):
        """Test updating multiple fields including payroll_number"""
        # Get personnel
        response = requests.get(f"{BASE_URL}/api/personnel", headers=auth_headers)
        personnel = response.json()
        test_person = personnel[3] if len(personnel) > 3 else personnel[0]
        
        original_payroll = test_person["payroll_number"]
        original_name = test_person["name"]
        
        # Update multiple fields
        test_payroll = f"TEST_{uuid.uuid4().hex[:6]}"
        test_name = f"TEST_Name_{uuid.uuid4().hex[:4]}"
        
        update_response = requests.put(
            f"{BASE_URL}/api/personnel/{test_person['id']}", 
            headers=auth_headers,
            json={
                "payroll_number": test_payroll,
                "name": test_name,
                "rank": "Captain"
            }
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["payroll_number"] == test_payroll
        assert updated["name"] == test_name
        assert updated["rank"] == "Captain"
        print(f"✓ Updated multiple fields including payroll_number")
        
        # Restore original values
        requests.put(
            f"{BASE_URL}/api/personnel/{test_person['id']}", 
            headers=auth_headers,
            json={
                "payroll_number": original_payroll,
                "name": original_name,
                "rank": test_person["rank"]
            }
        )
        print("✓ Restored original values")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
