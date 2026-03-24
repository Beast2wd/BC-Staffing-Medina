#!/usr/bin/env python3
"""
Medina County BC Staffing - Backend API Testing
Tests all API endpoints for the fire department staffing system
"""

import requests
import sys
import json
from datetime import datetime, timedelta

class MedinaStaffingAPITester:
    def __init__(self, base_url="https://medina-fire-staffing.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.bc_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
            self.failed_tests.append({"test": name, "details": details})

    def make_request(self, method, endpoint, data=None, token=None, expected_status=200):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            
            success = response.status_code == expected_status
            return success, response
            
        except requests.exceptions.RequestException as e:
            return False, str(e)

    def test_health_check(self):
        """Test health endpoint"""
        print("\n🔍 Testing Health Check...")
        success, response = self.make_request('GET', 'health')
        
        if success:
            try:
                data = response.json()
                self.log_test("Health Check", data.get('status') == 'healthy')
            except:
                self.log_test("Health Check", False, "Invalid JSON response")
        else:
            self.log_test("Health Check", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_admin_login(self):
        """Test admin login"""
        print("\n🔍 Testing Admin Login...")
        login_data = {
            "payroll_number": "100001",
            "password": "admin123"
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data)
        
        if success:
            try:
                data = response.json()
                if 'access_token' in data and 'user' in data:
                    self.admin_token = data['access_token']
                    user = data['user']
                    self.log_test("Admin Login", 
                                user.get('role') == 'admin' and user.get('payroll_number') == '100001')
                else:
                    self.log_test("Admin Login", False, "Missing token or user data")
            except:
                self.log_test("Admin Login", False, "Invalid JSON response")
        else:
            self.log_test("Admin Login", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_bc_login(self):
        """Test Battalion Chief login"""
        print("\n🔍 Testing Battalion Chief Login...")
        login_data = {
            "payroll_number": "100002",
            "password": "bc123"
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data)
        
        if success:
            try:
                data = response.json()
                if 'access_token' in data and 'user' in data:
                    self.bc_token = data['access_token']
                    user = data['user']
                    self.log_test("Battalion Chief Login", 
                                user.get('role') == 'battalion_chief' and user.get('payroll_number') == '100002')
                else:
                    self.log_test("Battalion Chief Login", False, "Missing token or user data")
            except:
                self.log_test("Battalion Chief Login", False, "Invalid JSON response")
        else:
            self.log_test("Battalion Chief Login", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_invalid_login(self):
        """Test invalid login credentials"""
        print("\n🔍 Testing Invalid Login...")
        login_data = {
            "payroll_number": "999999",
            "password": "wrongpassword"
        }
        
        success, response = self.make_request('POST', 'auth/login', login_data, expected_status=401)
        self.log_test("Invalid Login Rejection", success)

    def test_get_me(self):
        """Test get current user endpoint"""
        print("\n🔍 Testing Get Current User...")
        if not self.admin_token:
            self.log_test("Get Current User", False, "No admin token available")
            return
            
        success, response = self.make_request('GET', 'auth/me', token=self.admin_token)
        
        if success:
            try:
                data = response.json()
                self.log_test("Get Current User", 
                            data.get('payroll_number') == '100001' and data.get('role') == 'admin')
            except:
                self.log_test("Get Current User", False, "Invalid JSON response")
        else:
            self.log_test("Get Current User", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_get_battalions(self):
        """Test get battalions endpoint"""
        print("\n🔍 Testing Get Battalions...")
        if not self.admin_token:
            self.log_test("Get Battalions", False, "No admin token available")
            return
            
        success, response = self.make_request('GET', 'battalions', token=self.admin_token)
        
        if success:
            try:
                data = response.json()
                # Should have 2 battalions: 8110 and 8114
                battalion_numbers = [b.get('battalion_number') for b in data]
                expected_battalions = ['8110', '8114']
                has_expected = all(bn in battalion_numbers for bn in expected_battalions)
                self.log_test("Get Battalions", has_expected and len(data) >= 2)
            except:
                self.log_test("Get Battalions", False, "Invalid JSON response")
        else:
            self.log_test("Get Battalions", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_get_stations(self):
        """Test get stations endpoint"""
        print("\n🔍 Testing Get Stations...")
        if not self.admin_token:
            self.log_test("Get Stations", False, "No admin token available")
            return
            
        success, response = self.make_request('GET', 'stations', token=self.admin_token)
        
        if success:
            try:
                data = response.json()
                # Should have 8 stations: 10, 11, 12, 14, 15, 20, 40, 60
                station_numbers = [s.get('station_number') for s in data]
                expected_stations = ['10', '11', '12', '14', '15', '20', '40', '60']
                has_expected = all(sn in station_numbers for sn in expected_stations)
                self.log_test("Get Stations", has_expected and len(data) >= 8)
            except:
                self.log_test("Get Stations", False, "Invalid JSON response")
        else:
            self.log_test("Get Stations", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_get_personnel(self):
        """Test get personnel endpoint"""
        print("\n🔍 Testing Get Personnel...")
        if not self.admin_token:
            self.log_test("Get Personnel", False, "No admin token available")
            return
            
        success, response = self.make_request('GET', 'personnel', token=self.admin_token)
        
        if success:
            try:
                data = response.json()
                # Should have 120 personnel (8 stations * 3 shifts * 5 personnel per shift)
                self.log_test("Get Personnel", len(data) >= 100)  # Allow some flexibility
            except:
                self.log_test("Get Personnel", False, "Invalid JSON response")
        else:
            self.log_test("Get Personnel", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_shift_calendar(self):
        """Test shift calendar endpoint"""
        print("\n🔍 Testing Shift Calendar...")
        if not self.admin_token:
            self.log_test("Shift Calendar", False, "No admin token available")
            return
            
        # Test current month
        now = datetime.now()
        success, response = self.make_request('GET', f'shift-calendar?year={now.year}&month={now.month}', token=self.admin_token)
        
        if success:
            try:
                data = response.json()
                has_calendar = 'calendar' in data and 'year' in data and 'month' in data
                self.log_test("Shift Calendar", has_calendar)
            except:
                self.log_test("Shift Calendar", False, "Invalid JSON response")
        else:
            self.log_test("Shift Calendar", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_staffing_records(self):
        """Test staffing records endpoint"""
        print("\n🔍 Testing Staffing Records...")
        if not self.bc_token:
            self.log_test("Get Staffing Records", False, "No BC token available")
            return
            
        success, response = self.make_request('GET', 'staffing', token=self.bc_token)
        
        if success:
            try:
                data = response.json()
                self.log_test("Get Staffing Records", isinstance(data, list))
            except:
                self.log_test("Get Staffing Records", False, "Invalid JSON response")
        else:
            self.log_test("Get Staffing Records", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints"""
        print("\n🔍 Testing Unauthorized Access...")
        
        # Test accessing personnel without token
        success, response = self.make_request('GET', 'personnel', expected_status=401)
        self.log_test("Unauthorized Access Blocked", success)

    def test_admin_only_endpoints(self):
        """Test admin-only endpoints with BC token"""
        print("\n🔍 Testing Admin-Only Access Control...")
        if not self.bc_token:
            self.log_test("Admin-Only Access Control", False, "No BC token available")
            return
            
        # Try to access users endpoint with BC token (should fail)
        success, response = self.make_request('GET', 'users', token=self.bc_token, expected_status=403)
        self.log_test("Admin-Only Access Control", success)

    def test_seed_endpoint(self):
        """Test seed endpoint (should indicate already seeded)"""
        print("\n🔍 Testing Seed Endpoint...")
        if not self.admin_token:
            self.log_test("Seed Endpoint", False, "No admin token available")
            return
            
        success, response = self.make_request('POST', 'seed', token=self.admin_token)
        
        if success:
            try:
                data = response.json()
                # Should indicate already seeded
                self.log_test("Seed Endpoint", 'already seeded' in data.get('message', '').lower())
            except:
                self.log_test("Seed Endpoint", False, "Invalid JSON response")
        else:
            self.log_test("Seed Endpoint", False, f"Status: {response.status_code if hasattr(response, 'status_code') else response}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Medina County BC Staffing Backend API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Core functionality tests
        self.test_health_check()
        self.test_admin_login()
        self.test_bc_login()
        self.test_invalid_login()
        
        # Authentication tests
        self.test_get_me()
        self.test_unauthorized_access()
        self.test_admin_only_endpoints()
        
        # Data retrieval tests
        self.test_get_battalions()
        self.test_get_stations()
        self.test_get_personnel()
        self.test_shift_calendar()
        self.test_staffing_records()
        
        # System tests
        self.test_seed_endpoint()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = MedinaStaffingAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except Exception as e:
        print(f"💥 Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())