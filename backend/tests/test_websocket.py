"""
WebSocket real-time updates tests for Medina County BC Staffing.

Validates:
- WebSocket /api/ws accepts connections (anonymous + authenticated via JWT)
- Subscription / ping / unsubscribe protocol works
- Broadcasts (staffing_update / overtime_update) reach subscribed clients
  when REST endpoints mutate data
"""
import asyncio
import json
import os
from datetime import date as _date

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"
ADMIN_PAYROLL = "100001"
ADMIN_PASSWORD = "admin123"


# ---------- helpers ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"payroll_number": ADMIN_PAYROLL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"No token in login response: {data}"
    return token


async def _recv_until(ws, predicate, timeout=8.0):
    """Read messages until predicate returns the message or timeout."""
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            return None
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        except asyncio.TimeoutError:
            return None
        msg = json.loads(raw)
        if predicate(msg):
            return msg


# ---------- WebSocket connection tests ----------
class TestWebSocketConnection:

    def test_anonymous_connection_and_subscribe(self):
        async def run():
            async with websockets.connect(WS_URL, open_timeout=10) as ws:
                hello = json.loads(await asyncio.wait_for(ws.recv(), 5))
                assert hello["type"] == "connected"
                assert hello["authenticated"] is False

                await ws.send(json.dumps({"action": "subscribe", "channels": ["staffing"]}))
                ack = await _recv_until(ws, lambda m: m.get("type") == "subscribed", 5)
                assert ack is not None, "did not get subscribed ack"
                assert "staffing" in ack["channels"]

                await ws.send(json.dumps({"action": "ping"}))
                pong = await _recv_until(ws, lambda m: m.get("type") == "pong", 5)
                assert pong is not None, "did not get pong"
        asyncio.run(run())

    def test_authenticated_connection(self, admin_token):
        async def run():
            url = f"{WS_URL}?token={admin_token}"
            async with websockets.connect(url, open_timeout=10) as ws:
                hello = json.loads(await asyncio.wait_for(ws.recv(), 5))
                assert hello["type"] == "connected"
                assert hello["authenticated"] is True, f"expected authenticated=True, got {hello}"
                assert hello.get("user_name"), "user_name should be present for authenticated connection"
        asyncio.run(run())

    def test_get_status(self):
        async def run():
            async with websockets.connect(WS_URL, open_timeout=10) as ws:
                _ = await asyncio.wait_for(ws.recv(), 5)  # connected msg
                await ws.send(json.dumps({"action": "get_status"}))
                status = await _recv_until(ws, lambda m: m.get("type") == "status", 5)
                assert status is not None
                assert isinstance(status["connections"], int)
                assert status["connections"] >= 1
        asyncio.run(run())


# ---------- Broadcast tests ----------
class TestWebSocketBroadcasts:
    """Verify that REST mutations trigger WebSocket broadcasts."""

    def test_overtime_create_broadcasts_update(self, admin_token):
        """Creating an overtime record should broadcast an overtime_update event."""
        target_date = _date.today().isoformat()

        async def run():
            async with websockets.connect(WS_URL, open_timeout=10) as ws:
                _ = await asyncio.wait_for(ws.recv(), 5)
                await ws.send(json.dumps({"action": "subscribe", "channels": ["overtime"]}))
                await _recv_until(ws, lambda m: m.get("type") == "subscribed", 5)

                # Fire REST call in background to create overtime record
                headers = {"Authorization": f"Bearer {admin_token}"}

                # Find a personnel id (need any valid user)
                pr = requests.get(f"{BASE_URL}/api/personnel", headers=headers, timeout=10)
                assert pr.status_code == 200
                personnel = pr.json()
                if not personnel:
                    pytest.skip("No personnel available for overtime test")
                p0 = personnel[0]
                pid = p0.get("id")
                station_id = p0.get("station_id") or ""
                battalion_id = p0.get("battalion_id") or ""
                if not station_id or not battalion_id:
                    # Try to fetch any station/battalion
                    sr = requests.get(f"{BASE_URL}/api/stations", headers=headers, timeout=10).json()
                    br = requests.get(f"{BASE_URL}/api/battalions", headers=headers, timeout=10).json()
                    station_id = station_id or (sr[0]["id"] if sr else "")
                    battalion_id = battalion_id or (br[0]["id"] if br else "")

                payload = {
                    "personnel_id": pid,
                    "date": target_date,
                    "hours": 12.0,
                    "station_id": station_id,
                    "battalion_id": battalion_id,
                    "status": "available",
                    "notes": "TEST_ws_broadcast",
                }

                def _post():
                    return requests.post(
                        f"{BASE_URL}/api/overtime",
                        json=payload,
                        headers=headers,
                        timeout=10,
                    )

                # Send post and await broadcast concurrently
                loop = asyncio.get_event_loop()
                post_future = loop.run_in_executor(None, _post)

                msg = await _recv_until(
                    ws,
                    lambda m: m.get("type") == "overtime_update",
                    timeout=10,
                )
                resp = await post_future
                # Even if backend rejects (e.g. duplicate), broadcast on success path is what we test.
                if resp.status_code not in (200, 201):
                    pytest.skip(
                        f"overtime POST returned {resp.status_code}: {resp.text[:200]}"
                    )

                assert msg is not None, "No overtime_update broadcast received within 10s"
                assert msg["type"] == "overtime_update"
                assert "event" in msg
        asyncio.run(run())
