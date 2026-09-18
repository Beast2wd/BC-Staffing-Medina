"""Backend tests for Deployment Overtime Backfill Tracking feature."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0]
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, r.text
    d = r.json()
    return d.get("access_token") or d.get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def ff_token():
    for creds in [{"payroll_number": "200003", "password": "firefighter123"},
                  {"payroll_number": "200001", "password": "changeme123"},
                  {"payroll_number": "200001", "password": "firefighter123"}]:
        r = requests.post(f"{API}/auth/login", json=creds)
        if r.status_code == 200:
            d = r.json()
            tok = d.get("access_token") or d.get("token")
            if tok:
                return tok
    pytest.skip("No firefighter credentials work")


# ============ Active deployments ============
class TestActiveDeployments:
    def test_active_within_range(self, admin_headers):
        r = requests.get(f"{API}/deployments/active?date=2030-03-05", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        names = [d.get("personnel_name") for d in data]
        assert "Test User" in names
        d0 = next(d for d in data if d.get("personnel_name") == "Test User")
        assert d0.get("deployment_type") == "TIFMAS"

    def test_active_outside_range(self, admin_headers):
        r = requests.get(f"{API}/deployments/active?date=2030-04-01", headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) == 0


# ============ Overtime backfill fields ============
class TestOvertimeBackfillFields:
    def test_get_overtime_includes_backfill_fields(self, admin_headers):
        r = requests.get(f"{API}/overtime?date=2030-03-05&battalion_id=bat-8110", headers=admin_headers)
        assert r.status_code == 200, r.text
        recs = r.json()
        assert len(recs) >= 1
        aj = next((x for x in recs if x.get("backfill_deployment_id")), None)
        assert aj is not None, f"No OT with backfill_deployment_id found; recs={recs}"
        assert aj.get("backfill_deployment_type") == "TIFMAS"
        assert aj.get("backfill_for_personnel_name") == "Test User"

    def test_put_overtime_preserves_backfill(self, admin_headers):
        r = requests.get(f"{API}/overtime?date=2030-03-05&battalion_id=bat-8110", headers=admin_headers)
        rec = next(x for x in r.json() if x.get("backfill_deployment_id"))
        payload = {k: rec[k] for k in [
            "personnel_id", "date", "hours", "station_id", "battalion_id",
            "status", "shift_type"
        ] if k in rec}
        payload["backfill_deployment_id"] = rec["backfill_deployment_id"]
        payload["backfill_deployment_type"] = rec["backfill_deployment_type"]
        payload["backfill_for_personnel_name"] = rec["backfill_for_personnel_name"]
        # add optional fields
        for k in ["notes", "assigned_by", "reason"]:
            if k in rec and rec[k] is not None:
                payload[k] = rec[k]
        u = requests.put(f"{API}/overtime/{rec['id']}", headers=admin_headers, json=payload)
        assert u.status_code == 200, u.text
        got = u.json()
        assert got.get("backfill_deployment_id") == rec["backfill_deployment_id"]
        assert got.get("backfill_deployment_type") == "TIFMAS"
        assert got.get("backfill_for_personnel_name") == "Test User"


# ============ Backfill roster ============
class TestBackfillRoster:
    def test_roster_default(self, admin_headers):
        r = requests.get(f"{API}/deployments/backfill-roster?start_date=2030-03-01&end_date=2030-03-31", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["start_date"] == "2030-03-01"
        assert data["total_backfill_shifts"] >= 1
        assert data["total_backfill_hours"] >= 24
        deps = data["deployments"]
        tif = [d for d in deps if d.get("deployment_type") == "TIFMAS"]
        assert len(tif) >= 1
        aj_backfill = None
        for d in tif:
            for b in d.get("backfills", []):
                if b.get("personnel_name") == "Aj":
                    aj_backfill = b
        assert aj_backfill is not None, f"Aj backfill not present: {data}"
        assert aj_backfill["hours"] == 24
        assert "Station 10" in (aj_backfill.get("station_name") or "") or aj_backfill.get("station_name")

    def test_roster_emtf_empty(self, admin_headers):
        r = requests.get(f"{API}/deployments/backfill-roster?start_date=2030-03-01&end_date=2030-03-31&deployment_type=EMTF", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["deployments"] == []


# ============ Deployment Apparatus CRUD ============
class TestDeploymentApparatus:
    created_id = None

    def test_get_list(self, admin_headers):
        r = requests.get(f"{API}/deployment-apparatus", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert any(a.get("apparatus_name") == "Engine 10" for a in data)

    def test_create(self, admin_headers):
        payload = {
            "deployment_type": "EMTF",
            "apparatus_name": "TEST_Engine_99",
            "location": "TEST_Location",
            "departure_date": "2030-06-01",
            "departure_time": "07:15",
            "notes": "TEST"
        }
        r = requests.post(f"{API}/deployment-apparatus", headers=admin_headers, json=payload)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d.get("apparatus_name") == "TEST_Engine_99"
        assert d.get("deployment_type") == "EMTF"
        TestDeploymentApparatus.created_id = d["id"]

    def test_update(self, admin_headers):
        eid = TestDeploymentApparatus.created_id
        assert eid
        payload = {
            "deployment_type": "EMTF",
            "apparatus_name": "TEST_Engine_99",
            "location": "TEST_Location",
            "departure_date": "2030-06-01",
            "departure_time": "07:15",
            "return_date": "2030-06-05",
            "return_time": "18:00",
            "notes": "TEST updated"
        }
        r = requests.put(f"{API}/deployment-apparatus/{eid}", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("return_date") == "2030-06-05"

    def test_delete(self, admin_headers):
        eid = TestDeploymentApparatus.created_id
        r = requests.delete(f"{API}/deployment-apparatus/{eid}", headers=admin_headers)
        assert r.status_code == 200
        # 404 on unknown
        r2 = requests.delete(f"{API}/deployment-apparatus/nonexistent-{uuid.uuid4()}", headers=admin_headers)
        assert r2.status_code == 404

    def test_firefighter_cannot_write(self, ff_token, admin_headers):
        ff_headers = {"Authorization": f"Bearer {ff_token}", "Content-Type": "application/json"}
        payload = {
            "deployment_type": "TIFMAS",
            "apparatus_name": "TEST_forbidden",
            "location": "x",
            "departure_date": "2030-06-01",
            "departure_time": "07:00"
        }
        r = requests.post(f"{API}/deployment-apparatus", headers=ff_headers, json=payload)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# ============ Deployment summary report ============
class TestDeploymentSummary:
    def test_report_has_tifmas_emtf(self, admin_headers):
        r = requests.get(f"{API}/reports/deployment-summary?start_date=2030-03-01&end_date=2030-03-31", headers=admin_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "tifmas" in d, f"missing tifmas: {list(d.keys())}"
        assert "emtf" in d
        tif = d["tifmas"]
        assert tif.get("deployment_type") == "TIFMAS"
        assert tif.get("total_backfill_hours") == 24
        appar_names = [a.get("apparatus_name") for a in tif.get("apparatus", [])]
        assert "Engine 10" in appar_names
        e10 = next(a for a in tif["apparatus"] if a["apparatus_name"] == "Engine 10")
        assert e10.get("departure_date") == "2030-03-01"
        assert e10.get("departure_time") == "06:30"


# ============ Overtime duplicate 409 ============
class TestOvertimeDuplicate:
    def test_duplicate_409(self, admin_headers):
        # Try creating same OT for Aj on 2030-03-05 (already exists)
        payload = {
            "personnel_id": "b6846340-e112-43d9-a2be-c2ac43d41aae",
            "date": "2030-03-05",
            "hours": 12,
            "station_id": "sta-10",
            "battalion_id": "bat-8110",
            "status": "available",
            "shift_type": "24-hour"
        }
        r = requests.post(f"{API}/overtime", headers=admin_headers, json=payload)
        assert r.status_code == 409, f"expected 409, got {r.status_code}: {r.text}"
