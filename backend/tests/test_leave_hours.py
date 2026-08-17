"""Tests for LeaveRecord hours field (2-hour increment support)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://medina-fire-staffing.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def a_shift_person(headers):
    r = requests.get(f"{BASE_URL}/api/personnel", headers=headers)
    assert r.status_code == 200
    a_shift = [p for p in r.json() if p.get("shift") == "A" and p.get("is_active", True)]
    assert a_shift, "No A shift personnel"
    return a_shift[0]


def _create(headers, personnel_id, start_date, end_date, hours, leave_type="vacation"):
    payload = {
        "personnel_id": personnel_id,
        "leave_type": leave_type,
        "start_date": start_date,
        "end_date": end_date,
        "hours": hours,
        "status": "approved",
        "notes": "TEST_hours_field"
    }
    return requests.post(f"{BASE_URL}/api/leave-records", headers=headers, json=payload)


def _cleanup(headers, record_id):
    requests.delete(f"{BASE_URL}/api/leave-records/{record_id}", headers=headers)


class TestLeaveHours:
    def test_create_leave_with_8_hours(self, headers, a_shift_person):
        r = _create(headers, a_shift_person["id"], "2026-09-01", "2026-09-01", 8)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"
        data = r.json()
        assert data.get("hours") == 8, f"Expected hours=8, got {data.get('hours')}"
        assert data.get("start_date") == "2026-09-01"
        assert data.get("end_date") == "2026-09-01"
        _cleanup(headers, data["id"])

    def test_create_leave_with_24_hours_single_day(self, headers, a_shift_person):
        r = _create(headers, a_shift_person["id"], "2026-09-02", "2026-09-02", 24)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"
        data = r.json()
        assert data.get("hours") == 24
        assert data["start_date"] == data["end_date"]
        _cleanup(headers, data["id"])

    def test_create_leave_with_custom_hours(self, headers, a_shift_person):
        r = _create(headers, a_shift_person["id"], "2026-09-03", "2026-09-03", 3.5)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text}"
        data = r.json()
        assert data.get("hours") == 3.5
        _cleanup(headers, data["id"])

    def test_create_leave_48_hours_multiday(self, headers, a_shift_person):
        r = _create(headers, a_shift_person["id"], "2026-09-04", "2026-09-05", 48)
        assert r.status_code in (200, 201)
        data = r.json()
        assert data.get("hours") == 48
        assert data["end_date"] == "2026-09-05"
        _cleanup(headers, data["id"])

    def test_default_hours_when_omitted(self, headers, a_shift_person):
        payload = {
            "personnel_id": a_shift_person["id"],
            "leave_type": "sick",
            "start_date": "2026-09-06",
            "end_date": "2026-09-06",
            "status": "approved",
            "notes": "TEST_default"
        }
        r = requests.post(f"{BASE_URL}/api/leave-records", headers=headers, json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("hours") == 24.0, f"Default hours should be 24, got {data.get('hours')}"
        _cleanup(headers, data["id"])

    def test_get_persists_hours(self, headers, a_shift_person):
        r = _create(headers, a_shift_person["id"], "2026-09-07", "2026-09-07", 6, "holiday")
        assert r.status_code in (200, 201)
        rec_id = r.json()["id"]
        # verify via list
        list_r = requests.get(f"{BASE_URL}/api/leave-records?leave_type=holiday", headers=headers)
        assert list_r.status_code == 200
        match = [x for x in list_r.json() if x["id"] == rec_id]
        assert match, "Record not found in list"
        assert match[0]["hours"] == 6
        _cleanup(headers, rec_id)

    def test_update_hours(self, headers, a_shift_person):
        r = _create(headers, a_shift_person["id"], "2026-09-08", "2026-09-08", 8)
        rec_id = r.json()["id"]
        upd = requests.put(f"{BASE_URL}/api/leave-records/{rec_id}", headers=headers, json={
            "personnel_id": a_shift_person["id"],
            "leave_type": "vacation",
            "start_date": "2026-09-08",
            "end_date": "2026-09-08",
            "hours": 12,
            "status": "approved",
            "notes": "TEST_updated"
        })
        # PUT may or may not be supported; check
        if upd.status_code == 404:
            pytest.skip("PUT /leave-records/{id} not supported")
        assert upd.status_code in (200, 204), upd.text
        # verify
        list_r = requests.get(f"{BASE_URL}/api/leave-records?leave_type=vacation", headers=headers)
        match = [x for x in list_r.json() if x["id"] == rec_id]
        assert match and match[0]["hours"] == 12
        _cleanup(headers, rec_id)
