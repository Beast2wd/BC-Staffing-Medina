"""Tests for PTO Settings routes based on Medina County ESD1 Policy P-021"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "https://medina-fire-staffing.preview.emergentagent.com"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


class TestPTOSettings:
    def test_get_defaults(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pto-settings", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        # Vacation defaults per P-021
        assert data["vacation_accrual_frequency"] == "monthly"
        assert data["vacation_rollover_cap_operations"] == 240
        assert data["vacation_rollover_cap_admin"] == 120
        assert data["vacation_new_hire_waiting_months"] == 6
        assert data["vacation_allow_negative"] is True
        # Ops vacation rates 60/96/144/168
        ops = [r["hoursPerYear"] for r in data["vacation_rates_operations"]]
        assert ops == [60, 96, 144, 168]
        admin = [r["hoursPerYear"] for r in data["vacation_rates_admin"]]
        assert admin == [40, 80, 120, 140]
        # Holiday
        assert data["holiday_hours_per_holiday_operations"] == 12
        assert data["holiday_hours_per_holiday_admin"] == 8
        assert data["holiday_count"] == 11
        assert data["holiday_december_cashout_percent"] == 50
        assert data["holiday_call_off_penalty"] is True
        # Sick
        assert data["sick_rollover_cap"] == 1080
        assert data["sick_allow_negative"] is False
        sops = [r["hoursPerYear"] for r in data["sick_rates_operations"]]
        assert sops == [48, 72, 96]
        sadm = [r["hoursPerYear"] for r in data["sick_rates_admin"]]
        assert sadm == [40, 64, 80]

    def test_rates_summary(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/pto-settings/rates-summary", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "vacation" in data and "holiday" in data and "sick" in data
        assert data["vacation"]["rollover_cap_operations"] == 240
        assert data["vacation"]["rollover_cap_admin"] == 120
        assert data["holiday"]["hours_per_holiday_operations"] == 12
        assert data["holiday"]["december_cashout_percent"] == 50
        assert data["sick"]["rollover_cap"] == 1080
        assert data["sick"]["allow_negative"] is False

    def test_update_and_persist(self, auth_headers):
        # Get current
        r = requests.get(f"{BASE_URL}/api/pto-settings", headers=auth_headers)
        current = r.json()
        # Modify holiday count
        current["holiday_count"] = 12
        r = requests.put(f"{BASE_URL}/api/pto-settings", headers=auth_headers, json=current)
        assert r.status_code == 200, r.text
        # Verify
        r = requests.get(f"{BASE_URL}/api/pto-settings", headers=auth_headers)
        assert r.json()["holiday_count"] == 12
        # Restore
        current["holiday_count"] = 11
        requests.put(f"{BASE_URL}/api/pto-settings", headers=auth_headers, json=current)

    def test_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/pto-settings")
        assert r.status_code in (401, 403)
