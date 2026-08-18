"""
Tests for Leave Balance Dashboard & real-time bank sync (iteration_35)
- GET /api/leave-balances-by-type/{vacation|sick|holiday}
- POST/PUT/DELETE /api/leave-records mutate {leave_type}_current_balance
- Sick cannot go negative; vacation/holiday can
"""
import os
import pytest
import requests

def _get_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # Fallback: read from frontend/.env
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL"):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not set")
    return url.rstrip("/")

BASE_URL = _get_base_url()
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_personnel_id(headers):
    r = requests.get(f"{API}/personnel", headers=headers)
    assert r.status_code == 200
    for p in r.json():
        if p.get("payroll_number") == "200001":
            return p["id"]
    pytest.skip("Test personnel 200001 not found")


def _get_balance(headers, personnel_id, leave_type):
    r = requests.get(f"{API}/leave-balances-by-type/{leave_type}", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    for b in data["balances"]:
        if b["personnel_id"] == personnel_id:
            return b["current_balance"]
    return None


class TestLeaveBalancesByTypeEndpoint:
    def test_vacation_endpoint(self, headers):
        r = requests.get(f"{API}/leave-balances-by-type/vacation", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["leave_type"] == "vacation"
        assert "balances" in data and "summary" in data
        s = data["summary"]
        for key in ["total_personnel", "negative_count", "low_count", "at_cap_count", "total_hours"]:
            assert key in s
        if data["balances"]:
            b = data["balances"][0]
            for key in ["personnel_id", "payroll_number", "name", "shift", "current_balance", "cap", "status"]:
                assert key in b

    def test_sick_endpoint(self, headers):
        r = requests.get(f"{API}/leave-balances-by-type/sick", headers=headers)
        assert r.status_code == 200
        assert r.json()["leave_type"] == "sick"

    def test_holiday_endpoint(self, headers):
        r = requests.get(f"{API}/leave-balances-by-type/holiday", headers=headers)
        assert r.status_code == 200
        assert r.json()["leave_type"] == "holiday"

    def test_invalid_leave_type(self, headers):
        r = requests.get(f"{API}/leave-balances-by-type/foo", headers=headers)
        assert r.status_code == 400


class TestLeaveBalanceMutations:
    def test_create_deducts_vacation(self, headers, test_personnel_id):
        before = _get_balance(headers, test_personnel_id, "vacation")
        payload = {
            "personnel_id": test_personnel_id,
            "leave_type": "vacation",
            "start_date": "2026-03-01",
            "end_date": "2026-03-01",
            "hours": 8,
            "status": "approved",
            "notes": "TEST_vacation_deduct"
        }
        r = requests.post(f"{API}/leave-records", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        rec_id = r.json()["id"]
        after = _get_balance(headers, test_personnel_id, "vacation")
        assert round(after, 2) == round(before - 8, 2), f"expected {before-8}, got {after}"

        # Update to 12 hours => 4 more deducted
        payload2 = dict(payload, hours=12)
        r = requests.put(f"{API}/leave-records/{rec_id}", json=payload2, headers=headers)
        assert r.status_code == 200, r.text
        after2 = _get_balance(headers, test_personnel_id, "vacation")
        assert round(after2, 2) == round(before - 12, 2)

        # Delete => restore
        r = requests.delete(f"{API}/leave-records/{rec_id}", headers=headers)
        assert r.status_code == 200
        after3 = _get_balance(headers, test_personnel_id, "vacation")
        assert round(after3, 2) == round(before, 2)

    def test_sick_cannot_go_negative(self, headers, test_personnel_id):
        before = _get_balance(headers, test_personnel_id, "sick")
        # Attempt to deduct way more than available
        payload = {
            "personnel_id": test_personnel_id,
            "leave_type": "sick",
            "start_date": "2026-03-02",
            "end_date": "2026-03-02",
            "hours": before + 100,
            "status": "approved",
            "notes": "TEST_sick_negative"
        }
        r = requests.post(f"{API}/leave-records", json=payload, headers=headers)
        assert r.status_code == 200
        rec_id = r.json()["id"]
        after = _get_balance(headers, test_personnel_id, "sick")
        assert after >= 0, f"sick went negative: {after}"
        # cleanup
        requests.delete(f"{API}/leave-records/{rec_id}", headers=headers)

    def test_holiday_can_go_negative(self, headers, test_personnel_id):
        before = _get_balance(headers, test_personnel_id, "holiday")
        payload = {
            "personnel_id": test_personnel_id,
            "leave_type": "holiday",
            "start_date": "2026-03-03",
            "end_date": "2026-03-03",
            "hours": before + 50,
            "status": "approved",
            "notes": "TEST_holiday_negative"
        }
        r = requests.post(f"{API}/leave-records", json=payload, headers=headers)
        assert r.status_code == 200
        rec_id = r.json()["id"]
        after = _get_balance(headers, test_personnel_id, "holiday")
        assert after < 0, f"holiday did not go negative: {after}"
        requests.delete(f"{API}/leave-records/{rec_id}", headers=headers)
        restored = _get_balance(headers, test_personnel_id, "holiday")
        assert round(restored, 2) == round(before, 2)
