"""Backend tests for Leave Year Configuration feature."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://medina-fire-staffing.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def reset_after(client):
    yield
    # cleanup: reset to Jan 1
    client.put(f"{API}/tenants/settings", json={"leave_year_start_month": 1, "leave_year_start_day": 1})


class TestTenantsMe:
    def test_get_tenants_me(self, client):
        r = client.get(f"{API}/tenants/me")
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "settings" in data
        assert "leave_year_start_month" in data["settings"]
        assert "leave_year_start_day" in data["settings"]


class TestUpdateSettings:
    def test_update_to_federal_fy(self, client):
        r = client.put(f"{API}/tenants/settings", json={"leave_year_start_month": 10, "leave_year_start_day": 1})
        assert r.status_code == 200
        data = r.json()
        assert data["settings"]["leave_year_start_month"] == 10
        assert data["settings"]["leave_year_start_day"] == 1
        # verify persisted via GET
        r2 = client.get(f"{API}/tenants/me")
        assert r2.json()["settings"]["leave_year_start_month"] == 10

    def test_update_to_texas_fy(self, client):
        r = client.put(f"{API}/tenants/settings", json={"leave_year_start_month": 7, "leave_year_start_day": 1})
        assert r.status_code == 200
        assert r.json()["settings"]["leave_year_start_month"] == 7

    def test_update_to_uk_fy(self, client):
        r = client.put(f"{API}/tenants/settings", json={"leave_year_start_month": 4, "leave_year_start_day": 1})
        assert r.status_code == 200
        assert r.json()["settings"]["leave_year_start_month"] == 4

    def test_reset_to_calendar_year(self, client):
        r = client.put(f"{API}/tenants/settings", json={"leave_year_start_month": 1, "leave_year_start_day": 1})
        assert r.status_code == 200
        assert r.json()["settings"]["leave_year_start_month"] == 1
        assert r.json()["settings"]["leave_year_start_day"] == 1

    def test_invalid_month(self, client):
        r = client.put(f"{API}/tenants/settings", json={"leave_year_start_month": 13, "leave_year_start_day": 1})
        assert r.status_code == 400

    def test_invalid_month_zero(self, client):
        r = client.put(f"{API}/tenants/settings", json={"leave_year_start_month": 0, "leave_year_start_day": 1})
        assert r.status_code == 400

    def test_invalid_day(self, client):
        r = client.put(f"{API}/tenants/settings", json={"leave_year_start_day": 32})
        assert r.status_code == 400

    def test_invalid_day_zero(self, client):
        r = client.put(f"{API}/tenants/settings", json={"leave_year_start_day": 0})
        assert r.status_code == 400


class TestLeaveBalances:
    def test_calendar_year_balances(self, client):
        # set to calendar year
        client.put(f"{API}/tenants/settings", json={"leave_year_start_month": 1, "leave_year_start_day": 1})
        r = client.get(f"{API}/leave-balances")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            b = data[0]
            assert b["year_start"].endswith("-01-01")
            assert b["year_end"].endswith("-12-31")
            # year is calendar int (returned as int for Jan)
            assert str(b["year"]).isdigit() or "-" in str(b["year"])

    def test_federal_fy_balances(self, client):
        # set to Oct 1
        client.put(f"{API}/tenants/settings", json={"leave_year_start_month": 10, "leave_year_start_day": 1})
        r = client.get(f"{API}/leave-balances")
        assert r.status_code == 200
        data = r.json()
        if data:
            b = data[0]
            # year_start should be Oct 1 of some year
            assert "-10-01" in b["year_start"], f"Expected Oct 1 start, got {b['year_start']}"
            # year_end should be Sep 30 of next year
            assert "-09-30" in b["year_end"], f"Expected Sep 30 end, got {b['year_end']}"
            # fiscal year label should be like "2025-2026"
            assert "-" in str(b["year"]), f"Expected FY label with dash, got {b['year']}"

    def test_uk_fy_balances(self, client):
        client.put(f"{API}/tenants/settings", json={"leave_year_start_month": 4, "leave_year_start_day": 1})
        r = client.get(f"{API}/leave-balances")
        assert r.status_code == 200
        data = r.json()
        if data:
            b = data[0]
            assert "-04-01" in b["year_start"]
            assert "-03-31" in b["year_end"]
