"""Tests for PTO accrual rate display and monthly/holiday accrual processing (P-021)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://medina-fire-staffing.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def admin_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(f"{BASE_URL}/api/auth/login", json={
        "payroll_number": "100001",
        "password": "admin123"
    })
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    token = resp.json().get("access_token") or resp.json().get("token")
    assert token, f"No token in login response: {resp.json()}"
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="module")
def personnel_id(admin_client):
    resp = admin_client.get(f"{BASE_URL}/api/personnel")
    assert resp.status_code == 200
    personnel = resp.json()
    assert len(personnel) > 0, "No personnel available for testing"
    # prefer one with hire_date
    for p in personnel:
        if p.get("hire_date") or p.get("holiday_hire_date"):
            return p["id"]
    return personnel[0]["id"]


class TestAccrualRatesEndpoint:
    def test_get_all_rates_returns_calculated_data(self, admin_client, personnel_id):
        resp = admin_client.get(f"{BASE_URL}/api/pto-settings/personnel/{personnel_id}/all-rates")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        # Structural assertions
        for k in ["personnel_id", "personnel_name", "personnel_type", "years_of_service", "vacation", "sick", "holiday"]:
            assert k in data, f"Missing key: {k}"
        assert data["personnel_type"] in ["operations", "administrative"]
        # Vacation sub-object
        for k in ["tier", "hours_per_year", "hours_per_month", "current_balance", "rollover_cap"]:
            assert k in data["vacation"], f"Missing vacation.{k}"
        # Sick sub-object
        for k in ["tier", "hours_per_year", "hours_per_month", "current_balance", "rollover_cap"]:
            assert k in data["sick"], f"Missing sick.{k}"
        # Holiday sub-object
        for k in ["hours_per_holiday", "holiday_count", "hours_per_year", "current_balance"]:
            assert k in data["holiday"], f"Missing holiday.{k}"
        # Type-based sanity
        if data["personnel_type"] == "operations":
            assert data["holiday"]["hours_per_holiday"] == 12
        else:
            assert data["holiday"]["hours_per_holiday"] == 8

    def test_get_all_rates_invalid_personnel(self, admin_client):
        resp = admin_client.get(f"{BASE_URL}/api/pto-settings/personnel/nonexistent-id/all-rates")
        assert resp.status_code == 404


class TestMonthlyAccrualProcessing:
    def test_process_monthly_accrual(self, admin_client):
        # snapshot a personnel before
        p_resp = admin_client.get(f"{BASE_URL}/api/personnel")
        assert p_resp.status_code == 200
        before = {p["id"]: p.get("sick_current_balance", 0) for p in p_resp.json()}

        resp = admin_client.post(f"{BASE_URL}/api/pto-settings/process-monthly-accrual")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "summary" in data
        assert "personnel_processed" in data
        assert data["summary"]["total_personnel"] == len(data["personnel_processed"])
        assert data["summary"]["total_personnel"] >= 1
        # Each entry has expected fields
        for p in data["personnel_processed"]:
            for k in ["personnel_id", "name", "personnel_type", "vacation_accrued",
                      "vacation_new_balance", "vacation_eligible", "sick_accrued", "sick_new_balance"]:
                assert k in p, f"Missing key {k}"

        # Verify persistence: sick balance should have increased for at least someone
        p_resp2 = admin_client.get(f"{BASE_URL}/api/personnel")
        after = {p["id"]: p.get("sick_current_balance", 0) for p in p_resp2.json()}
        changed = [pid for pid in before if after.get(pid, 0) != before.get(pid, 0)]
        # At least one personnel should have accrued something
        assert len(changed) >= 1 or all(p["sick_accrued"] == 0 for p in data["personnel_processed"])


class TestHolidayAccrualProcessing:
    def test_process_holiday_accrual(self, admin_client):
        resp = admin_client.post(
            f"{BASE_URL}/api/pto-settings/process-holiday-accrual",
            params={"holiday_name": "TEST_Independence Day"}
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["holiday_name"] == "TEST_Independence Day"
        assert "summary" in data
        assert data["summary"]["total_personnel"] >= 1
        assert data["summary"]["total_holiday_hours_accrued"] > 0
        for p in data["personnel_processed"]:
            assert p["holiday_accrued"] in [8, 12]

    def test_process_holiday_missing_param(self, admin_client):
        resp = admin_client.post(f"{BASE_URL}/api/pto-settings/process-holiday-accrual")
        assert resp.status_code == 422  # missing required query param
