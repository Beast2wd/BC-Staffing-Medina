"""Tests for Personnel P-021 PTO fields (personnel_type, hire_date, current balances)"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, r.text
    tok = r.json().get("access_token") or r.json().get("token")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def created_personnel(auth_headers):
    payroll = f"TEST{uuid.uuid4().hex[:5].upper()}"
    payload = {
        "payroll_number": payroll,
        "name": "TEST_PTO User",
        "first_name": "TEST_PTO",
        "last_name": "User",
        "rank": "Firefighter",
        "shift": "A",
        "station": "Station 10",
        "station_id": "sta-10",
        "battalion_id": "bat-8110",
        "personnel_type": "administrative",
        "hire_date": "2020-05-15",
        "vacation_current_balance": 42.5,
        "sick_current_balance": 10.0,
        "holiday_current_balance": -5.0,
    }
    r = requests.post(f"{BASE_URL}/api/personnel", headers=auth_headers, json=payload)
    assert r.status_code in (200, 201), r.text
    person = r.json()
    yield person
    requests.delete(f"{BASE_URL}/api/personnel/{person['id']}", headers=auth_headers)


class TestPersonnelPTOFields:
    def test_create_persists_new_fields(self, created_personnel):
        p = created_personnel
        assert p["personnel_type"] == "administrative"
        assert p["hire_date"] == "2020-05-15"
        assert p["vacation_current_balance"] == 42.5
        assert p["sick_current_balance"] == 10.0
        assert p["holiday_current_balance"] == -5.0

    def test_get_returns_new_fields(self, auth_headers, created_personnel):
        r = requests.get(f"{BASE_URL}/api/personnel/{created_personnel['id']}", headers=auth_headers)
        assert r.status_code == 200
        p = r.json()
        assert p["personnel_type"] == "administrative"
        assert p["hire_date"] == "2020-05-15"
        assert p["vacation_current_balance"] == 42.5

    def test_update_persists_new_fields(self, auth_headers, created_personnel):
        pid = created_personnel["id"]
        update = {
            "personnel_type": "operations",
            "hire_date": "2015-01-10",
            "vacation_current_balance": 100.0,
            "sick_current_balance": 50.0,
            "holiday_current_balance": 24.0,
        }
        r = requests.put(f"{BASE_URL}/api/personnel/{pid}", headers=auth_headers, json=update)
        assert r.status_code == 200, r.text
        r = requests.get(f"{BASE_URL}/api/personnel/{pid}", headers=auth_headers)
        p = r.json()
        assert p["personnel_type"] == "operations"
        assert p["hire_date"] == "2015-01-10"
        assert p["vacation_current_balance"] == 100.0
        assert p["sick_current_balance"] == 50.0
        assert p["holiday_current_balance"] == 24.0

    def test_defaults_when_omitted(self, auth_headers):
        payroll = f"TEST{uuid.uuid4().hex[:5].upper()}"
        payload = {
            "payroll_number": payroll,
            "name": "TEST_DEF User",
            "first_name": "TEST_DEF",
            "last_name": "User",
            "rank": "Firefighter",
            "shift": "B",
            "station": "Station 10",
            "station_id": "sta-10",
            "battalion_id": "bat-8110",
        }
        r = requests.post(f"{BASE_URL}/api/personnel", headers=auth_headers, json=payload)
        assert r.status_code in (200, 201), r.text
        p = r.json()
        try:
            assert p.get("personnel_type") in ("operations", "administrative")
            assert p.get("vacation_current_balance", 0) == 0
            assert p.get("sick_current_balance", 0) == 0
            assert p.get("holiday_current_balance", 0) == 0
        finally:
            requests.delete(f"{BASE_URL}/api/personnel/{p['id']}", headers=auth_headers)
