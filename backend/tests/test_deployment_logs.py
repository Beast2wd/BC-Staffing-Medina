"""Tests for TIFMAS/EMTF deployment log APIs."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback to frontend/.env
    from pathlib import Path
    env = Path('/app/frontend/.env').read_text()
    for line in env.splitlines():
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
            break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login",
                      json={"payroll_number": "100001", "password": "admin123"},
                      timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- Rotation endpoints ---
def test_next_rotation_tifmas(headers):
    r = requests.get(f"{API}/deployment-roster/next-rotation/TIFMAS?count=100", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "suggestions" in data and "total_eligible" in data
    assert isinstance(data["suggestions"], list)
    assert data["total_eligible"] == 24, f"Expected 24 eligible, got {data['total_eligible']}"
    # Verify shape
    if data["suggestions"]:
        p = data["suggestions"][0]
        for k in ("id", "name", "person_rank", "last_deployment", "deployments_12mo"):
            assert k in p, f"Missing key {k}"


def test_next_rotation_emtf(headers):
    r = requests.get(f"{API}/deployment-roster/next-rotation/EMTF?count=100", headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total_eligible"] == 26, f"Expected 26 eligible, got {data['total_eligible']}"
    assert isinstance(data["suggestions"], list)


def test_next_rotation_sort_order_tifmas(headers):
    """'Never' deployed personnel should appear before those with dates; then by oldest date."""
    r = requests.get(f"{API}/deployment-roster/next-rotation/TIFMAS?count=100", headers=headers, timeout=20)
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    # After the last "Never", no more "Never" should appear
    seen_dated = False
    for p in suggestions:
        if p["last_deployment"] != "Never":
            seen_dated = True
        else:
            assert not seen_dated, f"'Never' appearing after dated deployment: {p['name']}"


# --- Deployment history creation ---
def test_create_deployment_history_tifmas(headers):
    # Get one person to deploy
    r = requests.get(f"{API}/deployment-roster/next-rotation/TIFMAS?count=1", headers=headers, timeout=20)
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    assert suggestions, "No TIFMAS personnel available"
    person = suggestions[0]

    payload = {
        "deployment_type": "TIFMAS",
        "incident_name": "TEST_Wildfire Incident",
        "location": "TEST_Johnson County, TX",
        "start_date": "2026-01-15",
        "end_date": "2026-01-20",
        "notes": "TEST record created by pytest",
        "personnel": [{"id": person["id"], "name": person["name"], "rank": person["person_rank"], "position": ""}],
        "status": "active"
    }
    r = requests.post(f"{API}/deployment-history", json=payload, headers=headers, timeout=20)
    assert r.status_code in (200, 201), f"Create failed: {r.status_code} {r.text}"
    data = r.json()
    dep_id = data.get("id")
    assert dep_id, f"No id in response: {data}"

    # Verify persistence via GET
    r2 = requests.get(f"{API}/deployment-history", headers=headers, timeout=15)
    assert r2.status_code == 200
    entries = r2.json()
    entries = entries if isinstance(entries, list) else entries.get("history", [])
    match = [e for e in entries if e.get("id") == dep_id]
    assert match, "Created TIFMAS deployment not found in history"
    assert match[0]["deployment_type"] == "TIFMAS"
    assert match[0]["incident_name"] == "TEST_Wildfire Incident"

    # Cleanup
    requests.delete(f"{API}/deployment-history/{dep_id}", headers=headers, timeout=15)


def test_create_deployment_history_emtf(headers):
    r = requests.get(f"{API}/deployment-roster/next-rotation/EMTF?count=1", headers=headers, timeout=20)
    assert r.status_code == 200
    suggestions = r.json()["suggestions"]
    assert suggestions
    person = suggestions[0]

    payload = {
        "deployment_type": "EMTF",
        "incident_name": "TEST_Hurricane Response",
        "location": "TEST_Galveston County, TX",
        "start_date": "2026-01-15",
        "personnel": [{"id": person["id"], "name": person["name"], "rank": person["person_rank"], "position": ""}],
        "status": "active"
    }
    r = requests.post(f"{API}/deployment-history", json=payload, headers=headers, timeout=20)
    assert r.status_code in (200, 201), f"Create failed: {r.status_code} {r.text}"
    dep_id = r.json().get("id")
    assert dep_id
    requests.delete(f"{API}/deployment-history/{dep_id}", headers=headers, timeout=15)
