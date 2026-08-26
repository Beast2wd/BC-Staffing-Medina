"""Tests for Leave Accrual Audit and Shift Coverage Heatmap reports."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://medina-fire-staffing.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"payroll_number": "100001", "password": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


class TestLeaveAccrualAudit:
    def test_all_personnel(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/leave-accrual-audit",
                         params={"start_date": "2026-01-01", "end_date": "2026-12-31"},
                         headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["start_date", "end_date", "personnel_count", "summary", "audit_data"]:
            assert k in data
        for k in ["total_usage", "total_accruals", "total_adjustments"]:
            assert k in data["summary"]
            for lt in ["vacation", "sick", "holiday"]:
                assert lt in data["summary"][k]
        assert isinstance(data["audit_data"], list)
        if data["audit_data"]:
            a = data["audit_data"][0]
            for k in ["personnel_id", "name", "payroll_number", "rank", "station",
                      "current_balances", "annual_allocations", "leave_usage",
                      "accruals", "adjustments", "transactions"]:
                assert k in a, f"missing key {k}"

    def test_single_personnel(self, headers):
        plist = requests.get(f"{BASE_URL}/api/reports/personnel-list", headers=headers).json()
        if not plist:
            pytest.skip("no personnel")
        pid = plist[0]["id"]
        r = requests.get(f"{BASE_URL}/api/reports/leave-accrual-audit",
                         params={"start_date": "2026-01-01", "end_date": "2026-12-31",
                                 "personnel_id": pid},
                         headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["personnel_id"] == pid
        assert data["personnel_count"] == 1

    def test_leave_type_filter(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/leave-accrual-audit",
                         params={"start_date": "2026-01-01", "end_date": "2026-12-31",
                                 "leave_type": "vacation"},
                         headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["leave_type_filter"] == "vacation"

    def test_missing_params(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/leave-accrual-audit", headers=headers)
        assert r.status_code == 422

    def test_personnel_not_found(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/leave-accrual-audit",
                         params={"start_date": "2026-01-01", "end_date": "2026-12-31",
                                 "personnel_id": "nonexistent-xyz"},
                         headers=headers)
        assert r.status_code == 404

    def test_unauth(self):
        r = requests.get(f"{BASE_URL}/api/reports/leave-accrual-audit",
                         params={"start_date": "2026-01-01", "end_date": "2026-12-31"})
        assert r.status_code in (401, 403)

    def test_no_object_id(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/leave-accrual-audit",
                         params={"start_date": "2026-01-01", "end_date": "2026-12-31"},
                         headers=headers)
        for a in r.json()["audit_data"]:
            assert "_id" not in a


class TestShiftCoverageHeatmap:
    def test_monthly(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/shift-coverage-heatmap",
                         params={"start_date": "2026-01-01", "end_date": "2026-01-31",
                                 "view_mode": "monthly"},
                         headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["start_date", "end_date", "view_mode", "dates", "station_count",
                  "overall_summary", "station_summaries", "grid_data"]:
            assert k in data
        assert data["view_mode"] == "monthly"
        for k in ["total_available", "total_assigned", "total_declined",
                  "total_hours", "coverage_rate"]:
            assert k in data["overall_summary"]
        assert isinstance(data["station_summaries"], list)
        assert isinstance(data["grid_data"], list)
        # Should include 31 dates for Jan
        assert len(data["dates"]) == 31

    def test_weekly(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/shift-coverage-heatmap",
                         params={"start_date": "2026-01-05", "end_date": "2026-01-11",
                                 "view_mode": "weekly"},
                         headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["view_mode"] == "weekly"
        assert len(data["dates"]) == 7

    def test_grid_structure(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/shift-coverage-heatmap",
                         params={"start_date": "2026-01-01", "end_date": "2026-01-07"},
                         headers=headers)
        assert r.status_code == 200
        data = r.json()
        if data["grid_data"]:
            row = data["grid_data"][0]
            for k in ["station_id", "station_name", "station_number", "cells"]:
                assert k in row
            if row["cells"]:
                cell = row["cells"][0]
                for k in ["date", "available", "assigned", "declined",
                          "total_hours", "intensity", "records"]:
                    assert k in cell

    def test_station_summaries(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/shift-coverage-heatmap",
                         params={"start_date": "2026-01-01", "end_date": "2026-01-31"},
                         headers=headers)
        assert r.status_code == 200
        data = r.json()
        # per problem statement 8 stations expected
        assert data["station_count"] >= 1
        if data["station_summaries"]:
            s = data["station_summaries"][0]
            for k in ["station_id", "station_name", "total_available",
                      "total_assigned", "total_declined", "total_hours",
                      "coverage_rate"]:
                assert k in s

    def test_missing_params(self, headers):
        r = requests.get(f"{BASE_URL}/api/reports/shift-coverage-heatmap", headers=headers)
        assert r.status_code == 422

    def test_unauth(self):
        r = requests.get(f"{BASE_URL}/api/reports/shift-coverage-heatmap",
                         params={"start_date": "2026-01-01", "end_date": "2026-01-31"})
        assert r.status_code in (401, 403)
