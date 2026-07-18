"""Tests for tenant branding endpoints (P3 Custom Tenant Branding)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://medina-fire-staffing.preview.emergentagent.com").rstrip("/")

DEFAULTS = {
    "primary_color": "#dc2626",
    "secondary_color": "#1e3a5f",
    "accent_color": "#f59e0b",
}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "payroll_number": "100001",
        "password": "admin123"
    })
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


def test_get_branding(auth_headers):
    r = requests.get(f"{BASE_URL}/api/tenants/branding", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ["custom_branding", "primary_color", "secondary_color", "accent_color", "tenant_name"]:
        assert key in data, f"missing key {key}"
    assert data["primary_color"].startswith("#")


def test_update_branding_navy_blue(auth_headers):
    payload = {
        "logo_url": None,
        "primary_color": "#1e40af",
        "secondary_color": "#0f172a",
        "accent_color": "#3b82f6",
        "custom_branding": True,
    }
    r = requests.put(f"{BASE_URL}/api/tenants/branding", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text

    # Verify persistence via GET
    r2 = requests.get(f"{BASE_URL}/api/tenants/branding", headers=auth_headers)
    assert r2.status_code == 200
    d = r2.json()
    assert d["primary_color"].lower() == "#1e40af"
    assert d["secondary_color"].lower() == "#0f172a"
    assert d["accent_color"].lower() == "#3b82f6"
    assert d["custom_branding"] is True


def test_reset_branding(auth_headers):
    r = requests.post(f"{BASE_URL}/api/tenants/branding/reset", headers=auth_headers)
    assert r.status_code == 200, r.text

    r2 = requests.get(f"{BASE_URL}/api/tenants/branding", headers=auth_headers)
    assert r2.status_code == 200
    d = r2.json()
    assert d["primary_color"].lower() == DEFAULTS["primary_color"]
    assert d["secondary_color"].lower() == DEFAULTS["secondary_color"]
    assert d["accent_color"].lower() == DEFAULTS["accent_color"]
    assert d["custom_branding"] is False


def test_update_with_logo_base64(auth_headers):
    tiny_png_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX/AAAZ4gk3AAAAAXRSTlPM0jRW/QAAAApJREFUeJxjYgAAAAYAAzY3fKgAAAAASUVORK5CYII="
    payload = {
        "logo_url": tiny_png_b64,
        "primary_code": None,  # extra ignored
        "primary_color": "#166534",
        "secondary_color": "#14532d",
        "accent_color": "#22c55e",
        "custom_branding": True,
    }
    r = requests.put(f"{BASE_URL}/api/tenants/branding", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text

    r2 = requests.get(f"{BASE_URL}/api/tenants/branding", headers=auth_headers)
    assert r2.status_code == 200
    d = r2.json()
    assert d["logo_url"] == tiny_png_b64
    assert d["primary_color"].lower() == "#166534"

    # cleanup
    requests.post(f"{BASE_URL}/api/tenants/branding/reset", headers=auth_headers)


def test_unauthenticated_denied():
    r = requests.get(f"{BASE_URL}/api/tenants/branding")
    assert r.status_code in (401, 403)
