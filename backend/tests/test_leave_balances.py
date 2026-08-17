"""Tests for /api/leave-balances endpoint and leave record CRUD sync."""
import os
import pytest
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


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
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def test_user_id(headers):
    r = requests.get(f"{BASE_URL}/api/personnel", headers=headers)
    assert r.status_code == 200
    for p in r.json():
        if p.get("payroll_number") == "200001" or "Test" in (p.get("name") or ""):
            return p["id"]
    # Fallback - first firefighter on A shift at station 10
    for p in r.json():
        if p.get("shift") == "A" and p.get("station_id") in ("sta-10", "sta-station-10"):
            return p["id"]
    return r.json()[0]["id"]


def test_leave_balances_endpoint_returns_list(headers):
    r = requests.get(f"{BASE_URL}/api/leave-balances", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) > 0
    sample = data[0]
    for k in ["personnel_id", "name", "shift", "vacation", "sick", "holiday", "year"]:
        assert k in sample, f"Missing key {k}"
    for lt in ["vacation", "sick", "holiday"]:
        assert "annual" in sample[lt] and "used" in sample[lt] and "remaining" in sample[lt]


def test_leave_balances_filter_by_person(headers, test_user_id):
    r = requests.get(
        f"{BASE_URL}/api/leave-balances?personnel_id={test_user_id}", headers=headers
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["personnel_id"] == test_user_id
    assert data[0]["vacation"]["annual"] == 15
    assert data[0]["sick"]["annual"] == 12
    assert data[0]["holiday"]["annual"] == 11


def test_leave_balance_updates_on_create_and_delete(headers, test_user_id):
    # Baseline
    r0 = requests.get(
        f"{BASE_URL}/api/leave-balances?personnel_id={test_user_id}", headers=headers
    )
    baseline_used = r0.json()[0]["vacation"]["used"]
    baseline_remaining = r0.json()[0]["vacation"]["remaining"]

    # Create a 1-shift vacation record (Aug 17 -> Aug 18 = 1 shift day)
    payload = {
        "personnel_id": test_user_id,
        "leave_type": "vacation",
        "start_date": "2026-08-17",
        "end_date": "2026-08-18",
        "status": "approved",
        "notes": "TEST_balance_sync",
    }
    rc = requests.post(f"{BASE_URL}/api/leave-records", headers=headers, json=payload)
    assert rc.status_code in (200, 201), rc.text
    record_id = rc.json()["id"]

    try:
        # Balance should reflect 1 more used
        r1 = requests.get(
            f"{BASE_URL}/api/leave-balances?personnel_id={test_user_id}", headers=headers
        )
        after_used = r1.json()[0]["vacation"]["used"]
        after_remaining = r1.json()[0]["vacation"]["remaining"]
        assert after_used == baseline_used + 1, (
            f"Expected used {baseline_used}+1, got {after_used}"
        )
        assert after_remaining == baseline_remaining - 1
    finally:
        rd = requests.delete(
            f"{BASE_URL}/api/leave-records/{record_id}", headers=headers
        )
        assert rd.status_code in (200, 204)

    # After delete, back to baseline
    r2 = requests.get(
        f"{BASE_URL}/api/leave-balances?personnel_id={test_user_id}", headers=headers
    )
    assert r2.json()[0]["vacation"]["used"] == baseline_used
    assert r2.json()[0]["vacation"]["remaining"] == baseline_remaining


def test_daily_worksheet_reflects_leave_create_and_delete(headers, test_user_id):
    """Verify Daily Worksheet vacation count updates on create then delete."""
    # Pick a date; use 2026-08-19 (choose a date less likely to already have vacation)
    date_str = "2026-08-19"

    def get_vacation_count_for_user(date):
        # Try common worksheet endpoints
        for url in [
            f"{BASE_URL}/api/daily-worksheet?date={date}",
            f"{BASE_URL}/api/staffing/daily-worksheet?date={date}",
            f"{BASE_URL}/api/leave-records?start_date={date}&end_date={date}",
        ]:
            r = requests.get(url, headers=headers)
            if r.status_code == 200:
                return r.status_code, r.json(), url
        return None, None, None

    status0, data0, url_used = get_vacation_count_for_user(date_str)
    assert status0 == 200, f"No worksheet-like endpoint responded 200 for {date_str}"

    # Count vacation leaves for this user on this date
    def count_vac(data):
        if isinstance(data, list):
            return sum(
                1
                for rec in data
                if rec.get("leave_type") == "vacation"
                and rec.get("personnel_id") == test_user_id
                and rec.get("start_date", "") <= date_str <= rec.get("end_date", "")
            )
        return 0

    baseline = count_vac(data0)

    # Create vacation
    payload = {
        "personnel_id": test_user_id,
        "leave_type": "vacation",
        "start_date": date_str,
        "end_date": "2026-08-20",
        "status": "approved",
        "notes": "TEST_worksheet_sync",
    }
    rc = requests.post(f"{BASE_URL}/api/leave-records", headers=headers, json=payload)
    assert rc.status_code in (200, 201), rc.text
    rid = rc.json()["id"]

    try:
        _, data_after, _ = get_vacation_count_for_user(date_str)
        after = count_vac(data_after)
        assert after == baseline + 1, (
            f"Vacation count did not increase after create: base={baseline}, after={after}"
        )
    finally:
        requests.delete(f"{BASE_URL}/api/leave-records/{rid}", headers=headers)

    _, data_final, _ = get_vacation_count_for_user(date_str)
    final = count_vac(data_final)
    assert final == baseline, (
        f"Leave still present after delete: base={baseline}, final={final}"
    )
