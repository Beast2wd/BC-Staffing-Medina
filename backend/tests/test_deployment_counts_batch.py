"""
Tests for personnel deployment counts + batch deployment creation.
Covers:
  - GET /api/personnel/with-deployment-counts (deployment_count, deployment_tifmas, deployment_emtf)
  - POST /api/deployments/batch (multi-personnel creation)
  - Persistence: counts increase after batch creation
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://medina-fire-staffing.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def admin_token():
    # Auth uses subdomain "medina" as tenant
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"payroll_number": "100001", "password": "admin123", "subdomain": "medina"},
        timeout=30,
    )
    if r.status_code != 200:
        # try alternate payload shape
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"payroll_number": "100001", "password": "admin123"},
            headers={"X-Tenant-Subdomain": "medina"},
            timeout=30,
        )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"no token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def headers(admin_token):
    return {
        "Authorization": f"Bearer {admin_token}",
        "X-Tenant-Subdomain": "medina",
        "Content-Type": "application/json",
    }


# ---------- Personnel with deployment counts ----------
class TestPersonnelWithDeploymentCounts:
    def test_endpoint_returns_list_with_required_fields(self, headers):
        r = requests.get(f"{BASE_URL}/api/personnel/with-deployment-counts", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0, "expected some personnel"
        for p in data[:5]:
            assert "id" in p
            assert "name" in p
            assert "deployment_count" in p
            assert "deployment_tifmas" in p
            assert "deployment_emtf" in p
            assert isinstance(p["deployment_count"], int)
            assert isinstance(p["deployment_tifmas"], int)
            assert isinstance(p["deployment_emtf"], int)
            # tifmas + emtf + other <= total (other may be absent)
            assert p["deployment_tifmas"] + p["deployment_emtf"] <= p["deployment_count"]

    def test_totals_are_consistent(self, headers):
        r = requests.get(f"{BASE_URL}/api/personnel/with-deployment-counts", headers=headers, timeout=30)
        assert r.status_code == 200
        data = r.json()
        # Sum of all deployment_count should be >= 0; ensure no negatives
        for p in data:
            assert p["deployment_count"] >= 0
            assert p["deployment_tifmas"] >= 0
            assert p["deployment_emtf"] >= 0


# ---------- Batch deployment ----------
class TestBatchDeployment:
    def _ensure_personnel(self, headers, count=2):
        r = requests.get(f"{BASE_URL}/api/personnel/with-deployment-counts", headers=headers, timeout=30)
        assert r.status_code == 200
        pl = r.json()
        created = []
        while len(pl) < count:
            payroll = f"TEST{uuid.uuid4().hex[:6].upper()}"
            body = {
                "payroll_number": payroll,
                "name": f"TEST_Person_{payroll}",
                "rank": "Firefighter",
                "station_id": "station-1",
                "shift": "A",
                "battalion_id": "battalion-1",
            }
            cr = requests.post(f"{BASE_URL}/api/personnel", headers=headers, json=body, timeout=30)
            assert cr.status_code == 200, f"create personnel failed: {cr.status_code} {cr.text}"
            created.append(cr.json())
            pl.append(cr.json())
        return [p["id"] for p in pl[:count]], created

    def _get_two_personnel_ids(self, headers):
        ids, _ = self._ensure_personnel(headers, 2)
        return ids

    def _get_count_map(self, headers):
        r = requests.get(f"{BASE_URL}/api/personnel/with-deployment-counts", headers=headers, timeout=30)
        assert r.status_code == 200
        return {p["id"]: p for p in r.json()}

    def test_batch_requires_personnel_ids(self, headers):
        r = requests.post(
            f"{BASE_URL}/api/deployments/batch",
            headers=headers,
            json={"personnel_ids": [], "deployment_type": "TIFMAS", "start_date": "2025-01-01"},
            timeout=30,
        )
        assert r.status_code == 400

    def test_batch_requires_type_and_start(self, headers):
        ids = self._get_two_personnel_ids(headers)
        r = requests.post(
            f"{BASE_URL}/api/deployments/batch",
            headers=headers,
            json={"personnel_ids": ids[:1], "deployment_type": "", "start_date": ""},
            timeout=30,
        )
        assert r.status_code == 400

    def test_batch_creates_multiple_and_counts_update(self, headers):
        ids = self._get_two_personnel_ids(headers)
        before = self._get_count_map(headers)
        before_a = before[ids[0]]["deployment_count"]
        before_b = before[ids[1]]["deployment_count"]
        before_a_tif = before[ids[0]]["deployment_tifmas"]

        unique_loc = f"TEST_BATCH_{uuid.uuid4().hex[:8]}"
        payload = {
            "personnel_ids": ids,
            "deployment_type": "TIFMAS",
            "start_date": "2025-06-01",
            "end_date": "2025-06-05",
            "location": unique_loc,
            "notes": "batch test",
        }
        r = requests.post(f"{BASE_URL}/api/deployments/batch", headers=headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["created_count"] == 2
        assert len(body["deployments"]) == 2
        for dep in body["deployments"]:
            assert dep["deployment_type"] == "TIFMAS"
            assert dep["location"] == unique_loc
            assert dep["start_date"] == "2025-06-01"

        # Verify counts on personnel-with-deployment-counts endpoint
        after = self._get_count_map(headers)
        assert after[ids[0]]["deployment_count"] == before_a + 1
        assert after[ids[1]]["deployment_count"] == before_b + 1
        assert after[ids[0]]["deployment_tifmas"] == before_a_tif + 1

        # Cleanup: delete created deployments
        for dep in body["deployments"]:
            dep_id = dep.get("id")
            if dep_id:
                requests.delete(f"{BASE_URL}/api/deployments/{dep_id}", headers=headers, timeout=30)

    def test_batch_emtf_type(self, headers):
        ids = self._get_two_personnel_ids(headers)[:1]
        before = self._get_count_map(headers)
        before_emtf = before[ids[0]]["deployment_emtf"]
        payload = {
            "personnel_ids": ids,
            "deployment_type": "EMTF",
            "start_date": "2025-07-01",
            "end_date": "2025-07-03",
            "location": f"TEST_EMTF_{uuid.uuid4().hex[:6]}",
        }
        r = requests.post(f"{BASE_URL}/api/deployments/batch", headers=headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["created_count"] == 1

        after = self._get_count_map(headers)
        assert after[ids[0]]["deployment_emtf"] == before_emtf + 1

        for dep in r.json()["deployments"]:
            dep_id = dep.get("id")
            if dep_id:
                requests.delete(f"{BASE_URL}/api/deployments/{dep_id}", headers=headers, timeout=30)
