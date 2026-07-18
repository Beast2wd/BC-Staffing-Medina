"""Backend tests for user deactivate and permanent delete endpoints."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://medina-fire-staffing.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def _create_test_user(headers, suffix=""):
    payroll = f"TEST{uuid.uuid4().hex[:6]}"
    payload = {
        "payroll_number": payroll,
        "password": "testpass123",
        "name": f"TEST User {suffix}",
        "rank": "Firefighter",
        "role": "firefighter",
        "station_id": "",
        "shift": "A",
        "email": "",
        "phone_number": "",
        "must_change_password": False,
    }
    r = requests.post(f"{API}/users", json=payload, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


class TestDeactivateUser:
    def test_deactivate_sets_inactive(self, admin_headers):
        user = _create_test_user(admin_headers, "deact")
        uid = user["id"]
        assert user["is_active"] is True

        r = requests.delete(f"{API}/users/{uid}", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert "deactivated" in r.json().get("message", "").lower()

        # Verify persistence via list
        r = requests.get(f"{API}/users", headers=admin_headers)
        assert r.status_code == 200
        found = [u for u in r.json() if u["id"] == uid]
        assert len(found) == 1
        assert found[0]["is_active"] is False

        # Cleanup: permanent delete
        requests.delete(f"{API}/users/{uid}/permanent", headers=admin_headers)

    def test_deactivate_nonexistent(self, admin_headers):
        r = requests.delete(f"{API}/users/nonexistent-id-xyz", headers=admin_headers)
        assert r.status_code == 404


class TestPermanentDelete:
    def test_permanent_delete_removes_user(self, admin_headers):
        user = _create_test_user(admin_headers, "perm")
        uid = user["id"]

        r = requests.delete(f"{API}/users/{uid}/permanent", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert "permanently deleted" in r.json().get("message", "").lower()

        # Verify user gone from list
        r = requests.get(f"{API}/users", headers=admin_headers)
        assert r.status_code == 200
        found = [u for u in r.json() if u["id"] == uid]
        assert len(found) == 0

    def test_permanent_delete_nonexistent(self, admin_headers):
        r = requests.delete(f"{API}/users/nonexistent-xyz/permanent", headers=admin_headers)
        assert r.status_code == 404

    def test_cannot_self_delete(self, admin_headers):
        # Get current admin id
        r = requests.get(f"{API}/users", headers=admin_headers)
        assert r.status_code == 200
        admin = next((u for u in r.json() if u["payroll_number"] == "100001"), None)
        assert admin is not None
        r = requests.delete(f"{API}/users/{admin['id']}/permanent", headers=admin_headers)
        # Either 403 self-deletion or 403 super admin protection
        assert r.status_code == 403, r.text


class TestUnauthorized:
    def test_deactivate_requires_auth(self):
        r = requests.delete(f"{API}/users/some-id")
        assert r.status_code in (401, 403)

    def test_permanent_delete_requires_auth(self):
        r = requests.delete(f"{API}/users/some-id/permanent")
        assert r.status_code in (401, 403)
