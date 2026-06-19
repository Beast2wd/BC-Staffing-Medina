"""
Post-refactor validation tests for Medina County BC Staffing
Verifies all /api/* endpoints work after splitting server.py into modular routes.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://medina-fire-staffing.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"payroll_number": "100001", "password": "admin123"}
BC = {"payroll_number": "100002", "password": "bc123"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data or "token" in data, f"No token in response: {data}"
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="session")
def bc_token():
    r = requests.post(f"{API}/auth/login", json=BC, timeout=15)
    assert r.status_code == 200, f"BC login failed: {r.status_code} {r.text}"
    data = r.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def bc_headers(bc_token):
    return {"Authorization": f"Bearer {bc_token}"}


# --- Health & Auth ---
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") in ("healthy", "ok", "up") or "status" in body


def test_admin_login_returns_user_role():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200
    data = r.json()
    # role should indicate admin
    user = data.get("user") or data
    role = user.get("role") or data.get("role")
    assert role and "admin" in str(role).lower()


def test_bc_login_returns_user_role():
    r = requests.post(f"{API}/auth/login", json=BC, timeout=15)
    assert r.status_code == 200
    data = r.json()
    user = data.get("user") or data
    role = (user.get("role") or data.get("role") or "").lower()
    assert role  # role should be present (battalion_chief)


# --- Resource list endpoints ---
@pytest.mark.parametrize("path", [
    "/stations",
    "/battalions",
    "/personnel",
    "/staffing",
    "/overtime",
    "/leave-records",
    "/deployments",
    "/deployment-roster",
    "/deployment-log",
    "/part-time-employees",
    "/part-time-availability",
    "/volunteer",
    "/notifications",
])
def test_list_endpoint_with_admin(path, admin_headers):
    r = requests.get(f"{API}{path}", headers=admin_headers, timeout=20)
    assert r.status_code == 200, f"GET {path} -> {r.status_code} body={r.text[:200]}"
    body = r.json()
    # Should be list or dict containing list
    assert isinstance(body, (list, dict)), f"Unexpected payload type for {path}"


def test_users_endpoint_admin_only(admin_headers):
    r = requests.get(f"{API}/users", headers=admin_headers, timeout=15)
    assert r.status_code == 200, f"GET /users -> {r.status_code} {r.text[:200]}"
    body = r.json()
    assert isinstance(body, list)
    # at least admin user present
    assert any(str(u.get("payroll_number")) == "100001" for u in body if isinstance(u, dict))


def test_volunteers_endpoint_admin(admin_headers):
    r = requests.get(f"{API}/volunteers", headers=admin_headers, timeout=15)
    assert r.status_code == 200, f"GET /volunteers -> {r.status_code} {r.text[:200]}"
    assert isinstance(r.json(), list)


def test_reports_daily_summary(admin_headers):
    from datetime import date
    params = {"date": date.today().isoformat(), "battalion_id": "bat-8110"}
    r = requests.get(f"{API}/reports/daily-summary", headers=admin_headers, params=params, timeout=20)
    assert r.status_code == 200, f"GET /reports/daily-summary -> {r.status_code} {r.text[:200]}"
    assert isinstance(r.json(), (list, dict))


def test_shift_calendar(admin_headers):
    from datetime import date
    today = date.today()
    params = {"year": today.year, "month": today.month}
    r = requests.get(f"{API}/shift-calendar", headers=admin_headers, params=params, timeout=15)
    assert r.status_code == 200, f"GET /shift-calendar -> {r.status_code} {r.text[:200]}"
    assert isinstance(r.json(), (list, dict))


# --- Data shape checks ---
def test_stations_have_expected_fields(admin_headers):
    r = requests.get(f"{API}/stations", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    stations = r.json()
    if isinstance(stations, list) and stations:
        s = stations[0]
        # mongo _id must NOT appear (excluded)
        assert "_id" not in s, "Mongo _id leaked into response"


def test_personnel_no_mongo_id_leak(admin_headers):
    r = requests.get(f"{API}/personnel", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    items = r.json()
    if isinstance(items, list) and items:
        assert "_id" not in items[0]


# --- BC access ---
def test_bc_can_access_stations(bc_headers):
    r = requests.get(f"{API}/stations", headers=bc_headers, timeout=15)
    assert r.status_code == 200


def test_bc_can_access_personnel(bc_headers):
    r = requests.get(f"{API}/personnel", headers=bc_headers, timeout=15)
    assert r.status_code == 200


def test_unauth_request_rejected():
    r = requests.get(f"{API}/users", timeout=10)
    assert r.status_code in (401, 403), f"Expected 401/403 for /users without auth, got {r.status_code}"
