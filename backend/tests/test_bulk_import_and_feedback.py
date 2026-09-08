"""Tests for:
- POST /api/deployment-roster/bulk-import (skip-existing behavior)
- POST /api/voice-feedback/submit accepts attachments (up to 5, 10MB each)
- GET /api/voice-feedback/list returns attachments_count
"""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback for tests to read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"payroll_number": "100001", "password": "admin123"},
                      timeout=30)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Bulk import ----------
class TestBulkImport:
    def test_bulk_import_adds_and_skips(self, auth_headers):
        unique = uuid.uuid4().hex[:6].upper()
        name_new = f"TEST_IMPORT_{unique}"
        payload = [
            {"name": name_new, "rank": "Firefighter", "eligible_tifmas": "true", "eligible_emtf": "yes"},
            {"name": name_new, "rank": "Firefighter"},  # duplicate in same batch
        ]
        r = requests.post(f"{BASE_URL}/api/deployment-roster/bulk-import",
                          json=payload, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["added"] == 1
        assert body["skipped"] == 1

        # Re-run: should skip both
        r2 = requests.post(f"{BASE_URL}/api/deployment-roster/bulk-import",
                           json=payload, headers=auth_headers, timeout=30)
        assert r2.status_code == 200
        body2 = r2.json()
        assert body2["added"] == 0
        assert body2["skipped"] == 2

    def test_bulk_import_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/deployment-roster/bulk-import",
                          json=[{"name": "X"}], timeout=30)
        assert r.status_code in (401, 403)

    def test_bulk_import_skips_missing_name(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/deployment-roster/bulk-import",
                          json=[{"name": ""}, {"rank": "Firefighter"}],
                          headers=auth_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["added"] == 0


# ---------- Voice Feedback attachments ----------
class TestVoiceFeedbackAttachments:
    def _make_audio(self):
        return ("voice.webm", b"FAKEAUDIODATA" * 10, "audio/webm")

    def test_submit_with_attachments(self, auth_headers):
        files = [
            ("audio", self._make_audio()),
            ("attachments", ("a.txt", b"hello world", "text/plain")),
            ("attachments", ("b.png", b"\x89PNG\r\n\x1a\n" + b"0" * 100, "image/png")),
        ]
        data = {
            "page_name": "TEST_PAGE",
            "page_url": "/test",
            "category": "bug",
            "priority": "medium",
        }
        r = requests.post(f"{BASE_URL}/api/voice-feedback/submit",
                          headers=auth_headers, data=data, files=files, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("attachments_count") == 2
        self.feedback_id = body.get("feedback_id") or body.get("id")

    def test_list_shows_attachments_count(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/voice-feedback/list",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        if isinstance(items, dict):
            items = items.get("feedback") or items.get("items") or items.get("data") or []
        assert isinstance(items, list) and len(items) > 0
        # Find one with attachments_count present
        found = [i for i in items if "attachments_count" in i]
        assert len(found) > 0
        # And at least one > 0
        assert any(i.get("attachments_count", 0) > 0 for i in items)

    def test_submit_rejects_too_many_attachments(self, auth_headers):
        files = [("audio", self._make_audio())]
        for i in range(6):
            files.append(("attachments", (f"f{i}.txt", b"x", "text/plain")))
        data = {"page_name": "TEST_PAGE", "page_url": "/test", "category": "bug", "priority": "low"}
        r = requests.post(f"{BASE_URL}/api/voice-feedback/submit",
                          headers=auth_headers, data=data, files=files, timeout=60)
        assert r.status_code == 400

    def test_submit_rejects_oversized_attachment(self, auth_headers):
        big = b"0" * (10 * 1024 * 1024 + 100)
        files = [
            ("audio", self._make_audio()),
            ("attachments", ("big.txt", big, "text/plain")),
        ]
        data = {"page_name": "TEST_PAGE", "page_url": "/test", "category": "bug", "priority": "low"}
        r = requests.post(f"{BASE_URL}/api/voice-feedback/submit",
                          headers=auth_headers, data=data, files=files, timeout=120)
        assert r.status_code == 400
