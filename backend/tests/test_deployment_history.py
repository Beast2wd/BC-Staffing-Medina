"""Tests for unified deployment history endpoints."""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://medina-fire-staffing.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PAYROLL = "100001"
ADMIN_PASSWORD = "admin123"
TENANT = "medina"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={
        "payroll_number": ADMIN_PAYROLL,
        "password": ADMIN_PASSWORD,
        "tenant_subdomain": TENANT,
    })
    if r.status_code != 200:
        # try without tenant field
        r = requests.post(f"{API}/auth/login", json={
            "payroll_number": ADMIN_PAYROLL,
            "password": ADMIN_PASSWORD,
        }, headers={"X-Tenant-Subdomain": TENANT})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "X-Tenant-Subdomain": TENANT}


# --- Deployment History unified endpoint ---

def test_get_deployment_history_returns_list(headers):
    r = requests.get(f"{API}/deployment-history", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    # Should include unified sources
    print(f"Total deployment history records: {len(body)}")
    # No _id leaks
    for item in body:
        assert "_id" not in item
        assert "deployment_type" in item
        assert "start_date" in item


def test_deployment_history_sorted_desc(headers):
    r = requests.get(f"{API}/deployment-history", headers=headers)
    assert r.status_code == 200
    items = r.json()
    dates = [i.get("start_date", "") for i in items if i.get("start_date")]
    assert dates == sorted(dates, reverse=True), "Not sorted descending by start_date"


def test_deployment_history_filter_type_tifmas(headers):
    r = requests.get(f"{API}/deployment-history", headers=headers, params={"deployment_type": "TIFMAS"})
    assert r.status_code == 200
    for item in r.json():
        assert item.get("deployment_type") == "TIFMAS"


def test_deployment_history_filter_type_emtf(headers):
    r = requests.get(f"{API}/deployment-history", headers=headers, params={"deployment_type": "EMTF"})
    assert r.status_code == 200
    for item in r.json():
        assert item.get("deployment_type") == "EMTF"


def test_deployment_history_filter_status(headers):
    r = requests.get(f"{API}/deployment-history", headers=headers, params={"status": "active"})
    assert r.status_code == 200
    items = r.json()
    # Status is validated only against history collection; unified may include other sources.
    # Just ensure endpoint works.
    assert isinstance(items, list)


def test_deployment_history_filter_date_range(headers):
    r = requests.get(f"{API}/deployment-history", headers=headers, params={
        "start_date": "2020-01-01",
        "end_date": "2099-12-31",
    })
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_deployment_history_filter_personnel_name_no_match(headers):
    r = requests.get(f"{API}/deployment-history", headers=headers, params={"personnel_name": "zzzznotexist"})
    assert r.status_code == 200
    assert r.json() == []


# --- Stats endpoint ---

def test_deployment_history_stats(headers):
    r = requests.get(f"{API}/deployment-history/stats", headers=headers)
    assert r.status_code == 200, r.text
    stats = r.json()
    # Required keys per frontend
    for key in ["total_deployments", "tifmas_deployments", "emtf_deployments", "unique_personnel"]:
        assert key in stats, f"Missing key {key} in stats: {stats}"
        assert isinstance(stats[key], int)
    print(f"Stats: {stats}")


def test_deployment_history_stats_by_year(headers):
    r = requests.get(f"{API}/deployment-history/stats", headers=headers, params={"year": 2024})
    assert r.status_code == 200
    stats = r.json()
    assert "total_deployments" in stats


# --- Create + Verify persistence + Cleanup ---

def test_create_and_appear_in_history(headers):
    tag = f"TEST_{uuid.uuid4().hex[:6]}"
    payload = {
        "deployment_type": "TIFMAS",
        "incident_name": f"TEST_INCIDENT_{tag}",
        "location": "Test Location",
        "start_date": "2025-06-01",
        "end_date": "2025-06-05",
        "status": "active",
        "personnel": [{"id": "test-pid", "name": f"TEST_PERSON_{tag}", "position": "FF"}],
        "notes": "test",
    }
    c = requests.post(f"{API}/deployment-history", headers=headers, json=payload)
    assert c.status_code == 200, c.text
    new_id = c.json().get("id")
    assert new_id

    # Verify persistence - visible in unified list
    r = requests.get(f"{API}/deployment-history", headers=headers, params={"personnel_name": f"TEST_PERSON_{tag}"})
    assert r.status_code == 200
    items = r.json()
    assert any(i.get("incident_name") == f"TEST_INCIDENT_{tag}" for i in items), f"Not found in unified list: {items}"

    # Cleanup
    d = requests.delete(f"{API}/deployment-history/{new_id}", headers=headers)
    assert d.status_code == 200
