"""Tests for new Part-Time Hours + Individual Personnel reports."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://medina-fire-staffing.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


class TestPartTimeHours:
    def test_month_range(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/part-time-hours",
                         params={"start_date": "2026-01-01", "end_date": "2026-01-31"},
                         headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["employee_count", "total_shifts", "total_hours", "employee_hours", "start_date", "end_date"]:
            assert k in data, f"missing key {k}"
        assert isinstance(data["employee_hours"], list)

    def test_custom_range(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/part-time-hours",
                         params={"start_date": "2025-01-01", "end_date": "2026-12-31"},
                         headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["employee_count"] >= 0
        # If employees exist, check structure
        if data["employee_hours"]:
            emp = data["employee_hours"][0]
            for k in ["employee_id", "employee_name", "total_hours", "shifts_count", "monthly_breakdown", "shifts"]:
                assert k in emp, f"missing employee key {k}"

    def test_missing_params(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/part-time-hours", headers=headers)
        assert r.status_code == 422


class TestPersonnelList:
    def test_list(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/personnel-list", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        if data:
            for k in ["id", "name", "payroll_number"]:
                assert k in data[0]

    def test_no_object_id(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/personnel-list", headers=headers)
        for p in r.json():
            assert "_id" not in p


class TestIndividualPersonnel:
    @pytest.fixture(scope="class")
    def personnel_id(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/personnel-list", headers=headers)
        lst = r.json()
        if not lst:
            pytest.skip("no personnel available")
        return lst[0]["id"]

    def test_individual_report(self, headers, personnel_id):
        r = requests.get(f"{BASE_URL}/api/reports/personnel/{personnel_id}", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["personnel", "leave_balances", "overtime", "riding_assignments", "deployments", "certifications", "leave_records", "report_period"]:
            assert k in data, f"missing top-level key {k}"
        # Validate leave balances structure
        for lt in ["vacation", "sick", "holiday"]:
            assert lt in data["leave_balances"]
            for k in ["current_balance", "hours_used_period"]:
                assert k in data["leave_balances"][lt]
        # Personnel profile fields
        for k in ["id", "name", "payroll_number", "rank", "shift"]:
            assert k in data["personnel"]

    def test_individual_with_range(self, headers, personnel_id):
        r = requests.get(f"{BASE_URL}/api/reports/personnel/{personnel_id}",
                         params={"start_date": "2026-01-01", "end_date": "2026-01-31"},
                         headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["report_period"]["start_date"] == "2026-01-01"
        assert data["report_period"]["end_date"] == "2026-01-31"

    def test_not_found(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/personnel/nonexistent-id-xyz", headers=headers)
        assert r.status_code == 404

    def test_unauth(self):
        r = requests.get(f"{BASE_URL}/api/reports/personnel-list")
        assert r.status_code in (401, 403)
