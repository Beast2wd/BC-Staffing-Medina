"""Tests for import history endpoints and roster export data source (iteration 43)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if BASE_URL:
    BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


# --- Bulk-import-with-history endpoint ---
class TestBulkImportWithHistory:
    def test_bulk_import_with_history_logs_entry(self, headers):
        payload = [{
            "name": f"TEST_HISTORY_{os.urandom(4).hex()}",
            "rank": "Firefighter",
            "eligible_tifmas": "true",
            "eligible_emtf": "false",
        }]
        r = requests.post(
            f"{BASE_URL}/api/deployment-roster/bulk-import-with-history",
            params={"filename": "unit_test.csv"},
            json=payload,
            headers=headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "added" in body and "skipped" in body
        assert body["added"] == 1
        assert "history_id" in body and body["history_id"]

    def test_import_history_returns_recent_entry(self, headers):
        # Trigger an import
        fname = f"unit_test_{os.urandom(3).hex()}.csv"
        payload = [{"name": f"TEST_HISTORY_{os.urandom(4).hex()}", "rank": "Firefighter"}]
        r = requests.post(
            f"{BASE_URL}/api/deployment-roster/bulk-import-with-history",
            params={"filename": fname},
            json=payload,
            headers=headers,
        )
        assert r.status_code == 200
        # Fetch history
        r2 = requests.get(f"{BASE_URL}/api/deployment-roster/import-history", headers=headers)
        assert r2.status_code == 200, r2.text
        data = r2.json()
        assert "history" in data
        assert isinstance(data["history"], list)
        assert len(data["history"]) > 0
        # Most recent should match filename
        found = next((h for h in data["history"] if h.get("filename") == fname), None)
        assert found is not None, f"Expected filename {fname} in history"
        for k in ["id", "user_name", "total_rows", "added", "skipped", "errors_count", "created_at"]:
            assert k in found

    def test_import_history_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/deployment-roster/import-history")
        assert r.status_code in (401, 403)

    def test_bulk_import_with_history_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/deployment-roster/bulk-import-with-history",
            json=[{"name": "x"}],
        )
        assert r.status_code in (401, 403)


# --- Roster data endpoints used by the Reports "Deployment Roster Export" ---
class TestRosterExportDataSources:
    def test_tifmas_rank_endpoint(self, headers):
        r = requests.get(f"{BASE_URL}/api/deployment-roster/tifmas-rank", headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_emtf_rank_endpoint(self, headers):
        r = requests.get(f"{BASE_URL}/api/deployment-roster/emtf-rank", headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
