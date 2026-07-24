"""Test platform settings public API and Super Admin update flow"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://medina-fire-staffing.preview.emergentagent.com').rstrip('/')

TEST_BG_URL = "https://example.com/test-bg-updated-by-testing-agent.jpg"


@pytest.fixture(scope="module")
def super_admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "payroll_number": "100001",
        "password": "admin123"
    })
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in response: {data}"
    return token


@pytest.fixture(scope="module")
def original_settings():
    r = requests.get(f"{BASE_URL}/api/platform/settings/public")
    assert r.status_code == 200
    return r.json()


def test_public_settings_endpoint_no_auth():
    r = requests.get(f"{BASE_URL}/api/platform/settings/public")
    assert r.status_code == 200
    data = r.json()
    assert "login_background_url" in data
    assert "hero_backgrounds" in data
    assert "logo_url" in data


def test_authenticated_settings_endpoint(super_admin_token):
    r = requests.get(f"{BASE_URL}/api/platform/settings",
                     headers={"Authorization": f"Bearer {super_admin_token}"})
    assert r.status_code == 200, r.text
    assert "login_background_url" in r.json()


def test_update_login_background_and_verify_persistence(super_admin_token, original_settings):
    # Update with test URL
    payload = dict(original_settings)
    payload["login_background_url"] = TEST_BG_URL
    # Ensure required-shape fields present
    payload.setdefault("hero_backgrounds", [])

    r = requests.put(f"{BASE_URL}/api/platform/settings",
                     json=payload,
                     headers={"Authorization": f"Bearer {super_admin_token}"})
    assert r.status_code == 200, f"Update failed: {r.status_code} {r.text}"

    # Verify via public endpoint
    r2 = requests.get(f"{BASE_URL}/api/platform/settings/public")
    assert r2.status_code == 200
    assert r2.json().get("login_background_url") == TEST_BG_URL

    # Restore original
    restore_payload = dict(original_settings)
    r3 = requests.put(f"{BASE_URL}/api/platform/settings",
                      json=restore_payload,
                      headers={"Authorization": f"Bearer {super_admin_token}"})
    assert r3.status_code == 200
    r4 = requests.get(f"{BASE_URL}/api/platform/settings/public")
    assert r4.json().get("login_background_url") == original_settings.get("login_background_url")


def test_public_endpoint_requires_no_auth():
    # Explicit: no auth header
    r = requests.get(f"{BASE_URL}/api/platform/settings/public", headers={})
    assert r.status_code == 200
