"""
Test notification creation when apparatus assignment is updated.
Verifies the bug fix where notifications now appear in user_notifications
collection (and therefore in the notification bell dropdown).
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

ADMIN_PAYROLL = "100001"
ADMIN_PASSWORD = "admin123"

# We'll use existing seeded personnel (payroll 200003 = Firefighter 10 shift A, station sta-10)
FIREFIGHTER_PAYROLL = "200003"
FIREFIGHTER_PASSWORD = "firefighter123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"payroll_number": ADMIN_PAYROLL, "password": ADMIN_PASSWORD},
    )
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    })
    return s


@pytest.fixture(scope="module")
def firefighter_user(admin_client):
    """Ensure a firefighter user exists matching personnel 200003."""
    # Find the personnel
    p_resp = admin_client.get(f"{BASE_URL}/api/personnel?station_id=sta-10")
    assert p_resp.status_code == 200
    personnel_list = p_resp.json()
    personnel = next((p for p in personnel_list if p["payroll_number"] == FIREFIGHTER_PAYROLL), None)
    assert personnel is not None, f"Personnel {FIREFIGHTER_PAYROLL} not found"

    # Try login first to see if user exists
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"payroll_number": FIREFIGHTER_PAYROLL, "password": FIREFIGHTER_PASSWORD},
    )
    if login_resp.status_code == 200:
        return {"personnel": personnel, "token": login_resp.json()["access_token"], "user": login_resp.json()["user"]}

    # Else set/reset firefighter user's password via admin endpoint
    set_pw_resp = admin_client.post(
        f"{BASE_URL}/api/auth/set-temporary-password",
        json={
            "personnel_id": personnel["id"],
            "temporary_password": FIREFIGHTER_PASSWORD,
        },
    )
    assert set_pw_resp.status_code == 200, f"set-temporary-password failed: {set_pw_resp.text}"

    # Login
    login_resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"payroll_number": FIREFIGHTER_PAYROLL, "password": FIREFIGHTER_PASSWORD},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    return {"personnel": personnel, "token": login_resp.json()["access_token"], "user": login_resp.json()["user"]}


@pytest.fixture(scope="module")
def firefighter_client(firefighter_user):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {firefighter_user['token']}",
        "Content-Type": "application/json",
    })
    return s


def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def test_firefighter_login(firefighter_user):
    """Verify firefighter login works"""
    assert firefighter_user["user"]["payroll_number"] == FIREFIGHTER_PAYROLL
    assert firefighter_user["user"]["role"] == "firefighter"


def test_user_notifications_endpoint_accessible(firefighter_client):
    """GET /api/user-notifications returns list for firefighter"""
    r = firefighter_client.get(f"{BASE_URL}/api/user-notifications")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_unread_count_endpoint(firefighter_client):
    """GET /api/user-notifications/unread-count returns count"""
    r = firefighter_client.get(f"{BASE_URL}/api/user-notifications/unread-count")
    assert r.status_code == 200, r.text
    assert "count" in r.json()
    assert isinstance(r.json()["count"], int)


def test_apparatus_update_creates_notification_for_personnel(admin_client, firefighter_client, firefighter_user):
    """
    Core bug fix test:
    When admin updates apparatus assignment personnel_ids,
    a notification should be created in user_notifications for the
    user matching that personnel.
    """
    personnel = firefighter_user["personnel"]
    test_date = _today()

    # 1. Clear existing notifications to get clean state
    firefighter_client.delete(f"{BASE_URL}/api/user-notifications/clear-all")

    # 2. Capture pre-count
    pre = firefighter_client.get(f"{BASE_URL}/api/user-notifications/unread-count").json()["count"]
    assert pre == 0

    # 3. Create a fresh apparatus assignment as admin (without firefighter)
    create_payload = {
        "date": test_date,
        "battalion_id": "bat-8110",
        "station_id": "sta-10",
        "shift": "A",
        "apparatus_name": f"TEST_Engine_{uuid.uuid4().hex[:6]}",
        "personnel_ids": [],
    }
    create_resp = admin_client.post(f"{BASE_URL}/api/apparatus-assignments", json=create_payload)
    assert create_resp.status_code == 200, create_resp.text
    assignment_id = create_resp.json()["id"]

    # 4. Admin updates the assignment, adding the firefighter's personnel_id
    update_resp = admin_client.put(
        f"{BASE_URL}/api/apparatus-assignments/{assignment_id}",
        json={"personnel_ids": [personnel["id"]]},
    )
    assert update_resp.status_code == 200, update_resp.text

    # 5. Wait for background task to run, then poll for notification (up to ~5s)
    import time
    notification_found = None
    for _ in range(10):
        time.sleep(0.5)
        notifs = firefighter_client.get(f"{BASE_URL}/api/user-notifications").json()
        notification_found = next(
            (n for n in notifs if n.get("type") == "assignment" and create_payload["apparatus_name"] in n.get("message", "")),
            None,
        )
        if notification_found:
            break

    assert notification_found is not None, (
        f"Expected an 'assignment' notification mentioning {create_payload['apparatus_name']} "
        f"in user_notifications for firefighter, but none was found."
    )

    # 6. Validate notification fields
    assert notification_found["title"] == "Riding Assignment Updated"
    assert "Station" in notification_found["message"]
    assert notification_found["is_read"] is False
    assert notification_found["link"] == "/on-duty"
    assert notification_found["link_label"] == "View On Duty"

    # 7. Validate unread count incremented
    count = firefighter_client.get(f"{BASE_URL}/api/user-notifications/unread-count").json()["count"]
    assert count >= 1, f"Expected unread count >= 1, got {count}"

    # 8. Verify mark-as-read works
    mark_resp = firefighter_client.put(
        f"{BASE_URL}/api/user-notifications/{notification_found['id']}/read"
    )
    assert mark_resp.status_code == 200

    # 9. Verify read state persisted
    notifs_after = firefighter_client.get(f"{BASE_URL}/api/user-notifications").json()
    updated = next((n for n in notifs_after if n["id"] == notification_found["id"]), None)
    assert updated is not None
    assert updated["is_read"] is True

    # Cleanup: delete test assignment
    admin_client.delete(f"{BASE_URL}/api/apparatus-assignments/{assignment_id}")


def test_part_time_prefix_not_notified(admin_client, firefighter_client, firefighter_user):
    """
    'pt-' prefixed personnel_ids should be skipped (no notification attempted).
    Ensures no errors occur and no spurious notification is created for the firefighter.
    """
    personnel = firefighter_user["personnel"]
    test_date = _today()

    # Clear notifications
    firefighter_client.delete(f"{BASE_URL}/api/user-notifications/clear-all")

    # Create assignment
    create_payload = {
        "date": test_date,
        "battalion_id": "bat-8110",
        "station_id": "sta-10",
        "shift": "A",
        "apparatus_name": f"TEST_PT_{uuid.uuid4().hex[:6]}",
        "personnel_ids": [],
    }
    create_resp = admin_client.post(f"{BASE_URL}/api/apparatus-assignments", json=create_payload)
    assert create_resp.status_code == 200
    assignment_id = create_resp.json()["id"]

    # Update with only pt- ids (should not notify firefighter; should not error)
    update_resp = admin_client.put(
        f"{BASE_URL}/api/apparatus-assignments/{assignment_id}",
        json={"personnel_ids": ["pt-fake-id-123"]},
    )
    assert update_resp.status_code == 200

    import time
    time.sleep(2)

    count = firefighter_client.get(f"{BASE_URL}/api/user-notifications/unread-count").json()["count"]
    assert count == 0, f"No notification should have been created for pt- ids; got {count}"

    # Cleanup
    admin_client.delete(f"{BASE_URL}/api/apparatus-assignments/{assignment_id}")
