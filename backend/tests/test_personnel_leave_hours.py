"""Backend tests for Personnel annual leave hours+days allocation."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://medina-fire-staffing.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def station_battalion(headers):
    stations = requests.get(f"{BASE_URL}/api/stations", headers=headers).json()
    battalions = requests.get(f"{BASE_URL}/api/battalions", headers=headers).json()
    assert stations and battalions
    return stations[0]["id"], battalions[0]["id"]


def test_create_personnel_with_days_and_hours(headers, station_battalion):
    station_id, battalion_id = station_battalion
    payload = {
        "payroll_number": "TEST_LH_001",
        "name": "TEST Leave Hours",
        "rank": "Firefighter",
        "station_id": station_id,
        "shift": "A",
        "battalion_id": battalion_id,
        "annual_vacation_days": 20,
        "annual_vacation_hours": 480,
        "annual_sick_days": 10,
        "annual_sick_hours": 240,
        "annual_holiday_days": 8,
        "annual_holiday_hours": 200,  # non-24 multiple to verify independent hours
    }
    r = requests.post(f"{BASE_URL}/api/personnel", headers=headers, json=payload)
    assert r.status_code in (200, 201), r.text
    created = r.json()
    pid = created["id"]

    # Verify persisted via GET list (find by payroll)
    listr = requests.get(f"{BASE_URL}/api/personnel", headers=headers)
    assert listr.status_code == 200
    match = [p for p in listr.json() if p.get("payroll_number") == "TEST_LH_001"]
    assert match, "Created personnel not found"
    p = match[0]
    assert p["annual_vacation_days"] == 20
    assert p["annual_vacation_hours"] == 480
    assert p["annual_sick_days"] == 10
    assert p["annual_sick_hours"] == 240
    assert p["annual_holiday_days"] == 8
    assert p["annual_holiday_hours"] == 200

    # Update hours independently
    upd = requests.put(f"{BASE_URL}/api/personnel/{pid}", headers=headers,
                      json={"annual_vacation_hours": 500, "annual_sick_hours": 300})
    assert upd.status_code == 200, upd.text

    listr2 = requests.get(f"{BASE_URL}/api/personnel", headers=headers).json()
    p2 = [x for x in listr2 if x["id"] == pid][0]
    assert p2["annual_vacation_hours"] == 500
    assert p2["annual_sick_hours"] == 300
    assert p2["annual_vacation_days"] == 20  # unchanged

    # cleanup
    requests.delete(f"{BASE_URL}/api/personnel/{pid}", headers=headers)


def test_defaults_when_not_provided(headers, station_battalion):
    station_id, battalion_id = station_battalion
    payload = {
        "payroll_number": "TEST_LH_002",
        "name": "TEST Defaults",
        "rank": "Firefighter",
        "station_id": station_id,
        "shift": "B",
        "battalion_id": battalion_id,
    }
    r = requests.post(f"{BASE_URL}/api/personnel", headers=headers, json=payload)
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    listr = requests.get(f"{BASE_URL}/api/personnel", headers=headers).json()
    p = [x for x in listr if x["id"] == pid][0]
    assert p["annual_vacation_days"] == 15
    assert p["annual_vacation_hours"] == 360
    assert p["annual_sick_days"] == 12
    assert p["annual_sick_hours"] == 288
    assert p["annual_holiday_days"] == 11
    assert p["annual_holiday_hours"] == 264
    requests.delete(f"{BASE_URL}/api/personnel/{pid}", headers=headers)
