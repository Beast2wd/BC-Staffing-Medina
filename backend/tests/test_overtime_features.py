"""
Test suite for Overtime Features:
1. DELETE /api/overtime/{id} endpoint
2. Hours tracking - overtime_hours_worked on personnel
3. POST /api/overtime for user submitting own availability
4. Personnel record includes overtime_hours_worked field
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOvertimeFeatures:
    """Test overtime management features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.admin_credentials = {"payroll_number": "100001", "password": "admin123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=self.admin_credentials)
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.user = response.json().get("user")
        else:
            pytest.skip("Admin login failed - skipping tests")
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_admin_login(self):
        """Test admin login works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=self.admin_credentials)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print("✓ Admin login successful")
    
    def test_personnel_has_overtime_hours_worked_field(self):
        """Test that personnel records include overtime_hours_worked field"""
        response = self.session.get(f"{BASE_URL}/api/personnel")
        assert response.status_code == 200
        personnel = response.json()
        assert len(personnel) > 0, "No personnel found"
        
        # Check first personnel has overtime_hours_worked field
        first_person = personnel[0]
        assert "overtime_hours_worked" in first_person, "Personnel missing overtime_hours_worked field"
        assert isinstance(first_person["overtime_hours_worked"], (int, float)), "overtime_hours_worked should be numeric"
        print(f"✓ Personnel has overtime_hours_worked field: {first_person['overtime_hours_worked']}")
    
    def test_get_overtime_records(self):
        """Test GET /api/overtime endpoint"""
        response = self.session.get(f"{BASE_URL}/api/overtime")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("✓ GET /api/overtime works")
    
    def test_create_overtime_record(self):
        """Test POST /api/overtime endpoint"""
        # Get a personnel to use
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel")
        assert personnel_response.status_code == 200
        personnel = personnel_response.json()
        assert len(personnel) > 0, "No personnel found"
        
        test_person = personnel[0]
        
        # Create overtime record
        overtime_data = {
            "personnel_id": test_person["id"],
            "date": "2026-01-20",
            "hours": 24,
            "station_id": test_person["station_id"],
            "battalion_id": test_person["battalion_id"],
            "status": "available",
            "notes": "TEST_overtime_record",
            "phone_number": "555-1234",
            "shift_type": "24"
        }
        
        response = self.session.post(f"{BASE_URL}/api/overtime", json=overtime_data)
        assert response.status_code == 200
        data = response.json()
        assert data["personnel_id"] == test_person["id"]
        assert data["hours"] == 24
        assert data["shift_type"] == "24"
        print(f"✓ Created overtime record: {data['id']}")
        
        # Store for cleanup
        self.created_overtime_id = data["id"]
        return data["id"]
    
    def test_delete_overtime_record(self):
        """Test DELETE /api/overtime/{id} endpoint"""
        # First create a record to delete
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel")
        personnel = personnel_response.json()
        test_person = personnel[0]
        
        overtime_data = {
            "personnel_id": test_person["id"],
            "date": "2026-01-21",
            "hours": 12,
            "station_id": test_person["station_id"],
            "battalion_id": test_person["battalion_id"],
            "status": "available",
            "notes": "TEST_delete_overtime",
            "phone_number": "555-5678",
            "shift_type": "12"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/overtime", json=overtime_data)
        assert create_response.status_code == 200
        record_id = create_response.json()["id"]
        print(f"✓ Created overtime record for deletion: {record_id}")
        
        # Now delete it
        delete_response = self.session.delete(f"{BASE_URL}/api/overtime/{record_id}")
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert "deleted" in data["message"].lower() or "message" in data
        print(f"✓ DELETE /api/overtime/{record_id} successful")
        
        # Verify it's gone
        get_response = self.session.get(f"{BASE_URL}/api/overtime", params={"date": "2026-01-21"})
        records = get_response.json()
        assert not any(r["id"] == record_id for r in records), "Record should be deleted"
        print("✓ Verified record is deleted")
    
    def test_hours_tracking_on_assign(self):
        """Test that overtime_hours_worked increases when status changes to 'assigned'"""
        # Get a personnel
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel")
        personnel = personnel_response.json()
        test_person = personnel[0]
        initial_hours = test_person.get("overtime_hours_worked", 0)
        print(f"Initial overtime hours for {test_person['name']}: {initial_hours}")
        
        # Create overtime record
        overtime_data = {
            "personnel_id": test_person["id"],
            "date": "2026-01-22",
            "hours": 24,
            "station_id": test_person["station_id"],
            "battalion_id": test_person["battalion_id"],
            "status": "available",
            "notes": "TEST_hours_tracking",
            "phone_number": "555-9999",
            "shift_type": "24"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/overtime", json=overtime_data)
        assert create_response.status_code == 200
        record = create_response.json()
        record_id = record["id"]
        print(f"✓ Created overtime record: {record_id}")
        
        # Update status to 'assigned'
        record["status"] = "assigned"
        update_response = self.session.put(f"{BASE_URL}/api/overtime/{record_id}", json=record)
        assert update_response.status_code == 200
        print("✓ Updated status to 'assigned'")
        
        # Check personnel hours increased
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel/{test_person['id']}")
        assert personnel_response.status_code == 200
        updated_person = personnel_response.json()
        new_hours = updated_person.get("overtime_hours_worked", 0)
        print(f"New overtime hours: {new_hours}")
        
        assert new_hours == initial_hours + 24, f"Expected {initial_hours + 24}, got {new_hours}"
        print(f"✓ Hours increased from {initial_hours} to {new_hours}")
        
        # Store for cleanup
        self.test_record_id = record_id
        self.test_person_id = test_person["id"]
        return record_id, test_person["id"], initial_hours
    
    def test_hours_tracking_on_decline_from_assigned(self):
        """Test that overtime_hours_worked decreases when status changes from 'assigned' to 'declined'"""
        # Get a personnel
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel")
        personnel = personnel_response.json()
        test_person = personnel[1] if len(personnel) > 1 else personnel[0]  # Use different person
        initial_hours = test_person.get("overtime_hours_worked", 0)
        print(f"Initial overtime hours for {test_person['name']}: {initial_hours}")
        
        # Create overtime record with status 'available'
        overtime_data = {
            "personnel_id": test_person["id"],
            "date": "2026-01-23",
            "hours": 12,
            "station_id": test_person["station_id"],
            "battalion_id": test_person["battalion_id"],
            "status": "available",
            "notes": "TEST_decline_tracking",
            "phone_number": "555-8888",
            "shift_type": "12"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/overtime", json=overtime_data)
        assert create_response.status_code == 200
        record = create_response.json()
        record_id = record["id"]
        
        # First assign it
        record["status"] = "assigned"
        update_response = self.session.put(f"{BASE_URL}/api/overtime/{record_id}", json=record)
        assert update_response.status_code == 200
        
        # Check hours increased
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel/{test_person['id']}")
        after_assign_hours = personnel_response.json().get("overtime_hours_worked", 0)
        assert after_assign_hours == initial_hours + 12
        print(f"✓ Hours after assign: {after_assign_hours}")
        
        # Now decline it
        record["status"] = "declined"
        decline_response = self.session.put(f"{BASE_URL}/api/overtime/{record_id}", json=record)
        assert decline_response.status_code == 200
        
        # Check hours decreased
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel/{test_person['id']}")
        after_decline_hours = personnel_response.json().get("overtime_hours_worked", 0)
        assert after_decline_hours == initial_hours, f"Expected {initial_hours}, got {after_decline_hours}"
        print(f"✓ Hours after decline: {after_decline_hours} (back to initial)")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/overtime/{record_id}")
    
    def test_12_hour_shift_type(self):
        """Test creating overtime with 12-hour shift type"""
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel")
        personnel = personnel_response.json()
        test_person = personnel[0]
        
        overtime_data = {
            "personnel_id": test_person["id"],
            "date": "2026-01-24",
            "hours": 12,
            "station_id": test_person["station_id"],
            "battalion_id": test_person["battalion_id"],
            "status": "available",
            "notes": "TEST_12_hour_shift",
            "phone_number": "555-1212",
            "shift_type": "12"
        }
        
        response = self.session.post(f"{BASE_URL}/api/overtime", json=overtime_data)
        assert response.status_code == 200
        data = response.json()
        assert data["shift_type"] == "12"
        assert data["hours"] == 12
        print(f"✓ 12-hour shift type works: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/overtime/{data['id']}")
    
    def test_24_hour_shift_type(self):
        """Test creating overtime with 24-hour shift type"""
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel")
        personnel = personnel_response.json()
        test_person = personnel[0]
        
        overtime_data = {
            "personnel_id": test_person["id"],
            "date": "2026-01-25",
            "hours": 24,
            "station_id": test_person["station_id"],
            "battalion_id": test_person["battalion_id"],
            "status": "available",
            "notes": "TEST_24_hour_shift",
            "phone_number": "555-2424",
            "shift_type": "24"
        }
        
        response = self.session.post(f"{BASE_URL}/api/overtime", json=overtime_data)
        assert response.status_code == 200
        data = response.json()
        assert data["shift_type"] == "24"
        assert data["hours"] == 24
        print(f"✓ 24-hour shift type works: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/overtime/{data['id']}")
    
    def test_delete_assigned_record_deducts_hours(self):
        """Test that deleting an assigned overtime record deducts hours from personnel"""
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel")
        personnel = personnel_response.json()
        test_person = personnel[2] if len(personnel) > 2 else personnel[0]
        initial_hours = test_person.get("overtime_hours_worked", 0)
        print(f"Initial hours: {initial_hours}")
        
        # Create and assign overtime
        overtime_data = {
            "personnel_id": test_person["id"],
            "date": "2026-01-26",
            "hours": 24,
            "station_id": test_person["station_id"],
            "battalion_id": test_person["battalion_id"],
            "status": "available",
            "notes": "TEST_delete_assigned",
            "phone_number": "555-7777",
            "shift_type": "24"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/overtime", json=overtime_data)
        record = create_response.json()
        record_id = record["id"]
        
        # Assign it
        record["status"] = "assigned"
        self.session.put(f"{BASE_URL}/api/overtime/{record_id}", json=record)
        
        # Verify hours increased
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel/{test_person['id']}")
        after_assign = personnel_response.json().get("overtime_hours_worked", 0)
        assert after_assign == initial_hours + 24
        print(f"✓ Hours after assign: {after_assign}")
        
        # Delete the assigned record
        delete_response = self.session.delete(f"{BASE_URL}/api/overtime/{record_id}")
        assert delete_response.status_code == 200
        
        # Verify hours deducted
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel/{test_person['id']}")
        after_delete = personnel_response.json().get("overtime_hours_worked", 0)
        assert after_delete == initial_hours, f"Expected {initial_hours}, got {after_delete}"
        print(f"✓ Hours after delete: {after_delete} (back to initial)")


class TestOvertimeAvailabilitySubmission:
    """Test user submitting their own overtime availability"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login as admin first to get personnel info"""
        self.admin_credentials = {"payroll_number": "100001", "password": "admin123"}
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=self.admin_credentials)
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Admin login failed")
    
    def test_user_can_submit_own_availability(self):
        """Test that a user can submit overtime availability for themselves"""
        # Get personnel list
        personnel_response = self.session.get(f"{BASE_URL}/api/personnel")
        assert personnel_response.status_code == 200
        personnel = personnel_response.json()
        
        # Find a personnel that matches admin's payroll (or use first one for testing)
        test_person = personnel[0]
        
        # Submit availability
        overtime_data = {
            "personnel_id": test_person["id"],
            "date": "2026-01-27",
            "hours": 24,
            "station_id": test_person["station_id"],
            "battalion_id": test_person["battalion_id"],
            "status": "available",
            "notes": "TEST_self_submit",
            "phone_number": "555-0000",
            "shift_type": "24"
        }
        
        response = self.session.post(f"{BASE_URL}/api/overtime", json=overtime_data)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "available"
        print(f"✓ User can submit overtime availability: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/overtime/{data['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
