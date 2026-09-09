"""Tests for the CSV Import Rollback feature (deployment roster).

Covers:
 - Bulk import stores added_entry_ids
 - POST /deployment-roster/import-history/{id}/rollback deletes added entries
 - Rollback marks history as rolled_back and returns deleted count
 - Rolling back twice returns 400
 - Rollback on history with no added_entry_ids returns 400
 - Rollback of missing id returns 404
 - Requires auth
"""
import os
import uuid
import pytest
import requests

from pathlib import Path
def _load_frontend_env():
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return None
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PAYROLL = "100001"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={
        "payroll_number": ADMIN_PAYROLL,
        "password": ADMIN_PASSWORD,
    })
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _mkrow(name):
    return {
        "name": name,
        "rank": "Firefighter",
        "ems_level": "EMT",
        "eligible_tifmas": "true",
        "eligible_emtf": "false",
        "pack_test_level": "Arduous",
    }


def test_rollback_requires_auth():
    r = requests.post(f"{API}/deployment-roster/import-history/{uuid.uuid4()}/rollback")
    assert r.status_code in (401, 403)


def test_rollback_nonexistent_id(headers):
    r = requests.post(
        f"{API}/deployment-roster/import-history/{uuid.uuid4()}/rollback",
        headers=headers,
    )
    assert r.status_code == 404


def test_import_stores_added_ids_and_rollback_removes_entries(headers):
    # Unique names so we actually add entries
    unique = uuid.uuid4().hex[:8]
    names = [f"TEST_RB_{unique}_A", f"TEST_RB_{unique}_B", f"TEST_RB_{unique}_C"]
    payload = [_mkrow(n) for n in names]

    r = requests.post(
        f"{API}/deployment-roster/bulk-import-with-history?filename=rollback_test.csv",
        headers=headers,
        json=payload,
    )
    assert r.status_code == 200, f"Import failed: {r.status_code} {r.text}"
    body = r.json()
    assert body["added"] == 3
    history_id = body["history_id"]
    assert history_id

    # Verify import history entry has added_entry_ids
    hist = requests.get(f"{API}/deployment-roster/import-history", headers=headers)
    assert hist.status_code == 200
    entries = hist.json()["history"]
    match = next((e for e in entries if e.get("id") == history_id), None)
    assert match is not None
    assert isinstance(match.get("added_entry_ids"), list)
    assert len(match["added_entry_ids"]) == 3
    assert match.get("rolled_back") in (False, None)

    # Verify roster contains the names
    roster = requests.get(f"{API}/deployment-roster/tifmas-rank", headers=headers).json()
    roster_names = {e.get("name") for e in roster}
    for n in names:
        assert n in roster_names, f"{n} missing from roster"

    # Rollback
    rb = requests.post(
        f"{API}/deployment-roster/import-history/{history_id}/rollback",
        headers=headers,
    )
    assert rb.status_code == 200, f"Rollback failed: {rb.status_code} {rb.text}"
    assert rb.json()["deleted"] == 3

    # Verify entries removed from roster
    roster2 = requests.get(f"{API}/deployment-roster/tifmas-rank", headers=headers).json()
    roster_names2 = {e.get("name") for e in roster2}
    for n in names:
        assert n not in roster_names2, f"{n} still present after rollback"

    # Verify history entry now marked rolled_back
    hist2 = requests.get(f"{API}/deployment-roster/import-history", headers=headers).json()["history"]
    match2 = next((e for e in hist2 if e.get("id") == history_id), None)
    assert match2 is not None
    assert match2.get("rolled_back") is True
    assert match2.get("rolled_back_count") == 3

    # Rolling back again returns 400
    rb2 = requests.post(
        f"{API}/deployment-roster/import-history/{history_id}/rollback",
        headers=headers,
    )
    assert rb2.status_code == 400


def test_rollback_history_without_added_entry_ids(headers):
    # Import with a duplicate-only payload -> added=0 -> added_entry_ids=[]
    # First ensure a name exists
    unique = uuid.uuid4().hex[:8]
    name = f"TEST_RB_DUP_{unique}"
    r1 = requests.post(
        f"{API}/deployment-roster/bulk-import-with-history?filename=seed.csv",
        headers=headers,
        json=[_mkrow(name)],
    )
    assert r1.status_code == 200
    seed_history_id = r1.json()["history_id"]

    # Now re-import same name -> should skip -> added=0
    r2 = requests.post(
        f"{API}/deployment-roster/bulk-import-with-history?filename=dup.csv",
        headers=headers,
        json=[_mkrow(name)],
    )
    assert r2.status_code == 200
    dup_body = r2.json()
    assert dup_body["added"] == 0
    dup_history_id = dup_body["history_id"]

    # Rollback the dup import -> 400
    rb = requests.post(
        f"{API}/deployment-roster/import-history/{dup_history_id}/rollback",
        headers=headers,
    )
    assert rb.status_code == 400

    # Cleanup: rollback the seed import
    requests.post(
        f"{API}/deployment-roster/import-history/{seed_history_id}/rollback",
        headers=headers,
    )
