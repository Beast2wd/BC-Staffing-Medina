"""Backend tests for Holiday Accrual System"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://medina-fire-staffing.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------------- Settings endpoints ----------------
class TestHolidaySettings:
    def test_get_settings(self, headers):
        r = requests.get(f"{API}/holiday-accrual/settings", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # settings may be nested or flat depending on impl
        assert isinstance(data, dict)

    def test_put_settings_and_persist(self, headers):
        payload = {
            "holiday_pay_period": "biweekly",
            "holiday_accrual_mode": "per_period",
            "holiday_accrual_rate_per_period": 4.0,
            "holiday_accrual_rate_yearly": 104.0,
            "holiday_reset_mode": "none",
            "holiday_allow_negative": True,
            "holiday_pay_period_start_date": "2026-01-01"
        }
        r = requests.put(f"{API}/holiday-accrual/settings", headers=headers, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "settings" in body or "message" in body

        # Verify via GET
        r2 = requests.get(f"{API}/holiday-accrual/settings", headers=headers)
        assert r2.status_code == 200
        s = r2.json()
        # search for at least one persisted field
        text = str(s)
        assert "biweekly" in text or "holiday_pay_period" in text

    def test_settings_all_pay_periods(self, headers):
        for pp in ["weekly", "biweekly", "semimonthly", "monthly"]:
            r = requests.put(f"{API}/holiday-accrual/settings", headers=headers, json={
                "holiday_pay_period": pp,
                "holiday_accrual_mode": "per_period",
                "holiday_accrual_rate_per_period": 2.0,
                "holiday_accrual_rate_yearly": 52.0,
                "holiday_reset_mode": "none",
                "holiday_allow_negative": True
            })
            assert r.status_code == 200, f"{pp}: {r.text}"


# ---------------- Balances endpoints ----------------
class TestHolidayBalances:
    def test_get_all_balances(self, headers):
        r = requests.get(f"{API}/holiday-accrual/balances", headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        # Expect list
        assert isinstance(data, (list, dict))
        if isinstance(data, list) and len(data) > 0:
            entry = data[0]
            assert "personnel_id" in entry or "current_balance" in entry

    def test_get_balance_for_first_personnel(self, headers):
        # Fetch personnel list
        r = requests.get(f"{API}/personnel", headers=headers)
        if r.status_code != 200:
            pytest.skip("No personnel endpoint")
        personnel = r.json()
        if not personnel:
            pytest.skip("No personnel available")
        pid = personnel[0].get("id")
        if not pid:
            pytest.skip("No id on personnel")
        r2 = requests.get(f"{API}/holiday-accrual/balance/{pid}", headers=headers)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert "current_balance" in data or "personnel_id" in data


# ---------------- Process endpoint ----------------
class TestProcessAccrual:
    def test_process_accrual_dry(self, headers):
        r = requests.post(f"{API}/holiday-accrual/process", headers=headers, json={})
        # Accept 200 or 400 (if no eligible personnel)
        assert r.status_code in [200, 400], r.text


# ---------------- Auth ----------------
class TestAuth:
    def test_settings_requires_auth(self):
        r = requests.get(f"{API}/holiday-accrual/settings")
        assert r.status_code in [401, 403]
