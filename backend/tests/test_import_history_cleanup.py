"""Tests for DELETE /api/deployment-roster/import-history cleanup endpoint (iteration 44)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if BASE_URL:
    BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"payroll_number": "100001", "password": "admin123"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


def _seed_entry(headers, filename="cleanup_test.csv"):
    payload = [{
        "name": f"TEST_CLEANUP_{os.urandom(4).hex()}",
        "rank": "Firefighter",
        "eligible_tifmas": "true",
        "eligible_emtf": "false",
    }]
    r = requests.post(
        f"{BASE_URL}/api/deployment-roster/bulk-import-with-history",
        params={"filename": filename},
        json=payload,
        headers=headers,
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestClearImportHistory:
    """DELETE /api/deployment-roster/import-history"""

    def test_delete_requires_auth(self):
        r = requests.delete(f"{BASE_URL}/api/deployment-roster/import-history")
        assert r.status_code in (401, 403)

    def test_delete_older_than_days_zero_clears_all(self, headers):
        # Seed at least one history entry
        _seed_entry(headers, filename="cleanup_all.csv")

        # Verify some history exists
        pre = requests.get(
            f"{BASE_URL}/api/deployment-roster/import-history", headers=headers
        )
        assert pre.status_code == 200
        assert len(pre.json().get("history", [])) >= 1

        # Delete all (older_than_days=0)
        r = requests.delete(
            f"{BASE_URL}/api/deployment-roster/import-history",
            params={"older_than_days": 0},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "deleted" in body
        assert isinstance(body["deleted"], int)
        assert body["deleted"] >= 1

        # Verify history is now empty
        post = requests.get(
            f"{BASE_URL}/api/deployment-roster/import-history", headers=headers
        )
        assert post.status_code == 200
        assert post.json().get("history", []) == []

    def test_delete_older_than_days_large_deletes_nothing(self, headers):
        # Seed a fresh entry (created "now")
        _seed_entry(headers, filename="cleanup_recent.csv")

        # older_than_days=365 should not delete anything recent
        r = requests.delete(
            f"{BASE_URL}/api/deployment-roster/import-history",
            params={"older_than_days": 365},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["deleted"] == 0

        # History still contains the recent entry
        post = requests.get(
            f"{BASE_URL}/api/deployment-roster/import-history", headers=headers
        )
        assert post.status_code == 200
        assert len(post.json().get("history", [])) >= 1

    def test_delete_supports_common_periods(self, headers):
        # Verify all period options accepted by frontend produce a 200 response.
        for days in (30, 90, 180, 365):
            r = requests.delete(
                f"{BASE_URL}/api/deployment-roster/import-history",
                params={"older_than_days": days},
                headers=headers,
            )
            assert r.status_code == 200, f"days={days} -> {r.status_code} {r.text}"
            assert "deleted" in r.json()
