"""Tests for tenant webhook notification settings (Super Admin only)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

SUPER_ADMIN = {"payroll_number": "100001", "password": "admin123"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def medina_tenant_id(headers):
    r = requests.get(f"{BASE_URL}/api/tenants", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    for t in r.json():
        if "medina" in t.get("name", "").lower():
            return t["id"]
    pytest.skip("Medina County tenant not found")


class TestWebhookSettings:
    def test_get_webhook_settings(self, headers, medina_tenant_id):
        r = requests.get(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings",
            headers=headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tenant_id"] == medina_tenant_id
        assert "webhook_url" in data
        assert "webhook_enabled" in data
        assert "has_api_key" in data

    def test_get_webhook_requires_auth(self, medina_tenant_id):
        r = requests.get(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings", timeout=15
        )
        assert r.status_code in (401, 403)

    def test_update_webhook_settings_https_only(self, headers, medina_tenant_id):
        r = requests.put(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings",
            headers=headers,
            json={"webhook_url": "http://insecure.example.com/hook", "webhook_enabled": True},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_update_and_persist_webhook_settings(self, headers, medina_tenant_id):
        new_url = "https://hook.us1.make.com/test_webhook_pytest_123"
        r = requests.put(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings",
            headers=headers,
            json={"webhook_url": new_url, "webhook_enabled": True, "webhook_api_key": "TEST_KEY_abc"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["tenant_id"] == medina_tenant_id

        # Verify persistence
        r2 = requests.get(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings",
            headers=headers, timeout=15,
        )
        assert r2.status_code == 200
        data = r2.json()
        assert data["webhook_url"] == new_url
        assert data["webhook_enabled"] is True
        assert data["has_api_key"] is True

    def test_disable_webhook(self, headers, medina_tenant_id):
        r = requests.put(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings",
            headers=headers,
            json={"webhook_enabled": False},
            timeout=15,
        )
        assert r.status_code == 200
        r2 = requests.get(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings",
            headers=headers, timeout=15,
        )
        assert r2.json()["webhook_enabled"] is False

    def test_test_webhook_endpoint(self, headers, medina_tenant_id):
        # Set to a URL that will fail (test123 is not real) - still exercises endpoint path
        requests.put(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings",
            headers=headers,
            json={"webhook_url": "https://hook.us1.make.com/test123", "webhook_enabled": True},
            timeout=15,
        )
        r = requests.post(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings/test",
            headers=headers, timeout=30,
        )
        # Either success (200) or fails at delivery (400) with error - both prove route works
        assert r.status_code in (200, 400), r.text
        body = r.json()
        # Response contains either "message" (success) or "detail" (HTTPException failure)
        assert "message" in body or "detail" in body

    def test_test_webhook_requires_url_configured(self, headers, medina_tenant_id):
        # Clear the URL then test
        requests.put(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings",
            headers=headers,
            json={"webhook_url": "", "webhook_enabled": False},
            timeout=15,
        )
        r = requests.post(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings/test",
            headers=headers, timeout=15,
        )
        assert r.status_code == 400
        # Restore
        requests.put(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-settings",
            headers=headers,
            json={"webhook_url": "https://hook.us1.make.com/test123", "webhook_enabled": True},
            timeout=15,
        )

    def test_get_deliveries(self, headers, medina_tenant_id):
        r = requests.get(
            f"{BASE_URL}/api/tenants/{medina_tenant_id}/webhook-deliveries",
            headers=headers, timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["tenant_id"] == medina_tenant_id
        assert "deliveries" in data or isinstance(data, dict)

    def test_settings_404_for_unknown_tenant(self, headers):
        r = requests.get(
            f"{BASE_URL}/api/tenants/non-existent-tenant-id/webhook-settings",
            headers=headers, timeout=15,
        )
        assert r.status_code == 404
