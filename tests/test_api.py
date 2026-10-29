"""Tests for FastAPI backend endpoints, schemas, and state mutation."""

import pytest
from fastapi.testclient import TestClient
from src.api.main import app, load_cached_data


@pytest.fixture(scope="session")
def client():
    load_cached_data()
    return TestClient(app)


def test_health_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["version"] == "2.0.0"


def test_seniors_list_endpoint(client):
    res = client.get("/seniors?limit=10")
    assert res.status_code == 200
    seniors = res.json()
    assert len(seniors) == 10
    assert "senior_id" in seniors[0]
    assert "age" in seniors[0]


def test_latest_risk_endpoint(client):
    res = client.get("/seniors/S0001/latest-risk")
    assert res.status_code == 200
    data = res.json()
    assert data["senior_id"] == "S0001"
    assert "risk_score" in data
    assert "risk_level" in data
    assert "top_contributing_factors" in data


def test_risk_history_endpoint(client):
    res = client.get("/seniors/S0001/risk-history?start_date=2026-01-01&end_date=2026-01-07")
    assert res.status_code == 200
    history = res.json()
    assert len(history) == 7


def test_alerts_list_and_detail(client):
    res = client.get("/alerts")
    assert res.status_code == 200
    alerts = res.json()
    assert len(alerts) > 0
    first_id = alerts[0]["alert_id"]

    # Detail
    res_detail = client.get(f"/alerts/{first_id}")
    assert res_detail.status_code == 200
    assert res_detail.json()["alert_id"] == first_id


def test_alert_acknowledge_and_resolve(client):
    res = client.get("/alerts")
    alerts = res.json()
    alert_id = alerts[0]["alert_id"]

    # Acknowledge
    ack_res = client.post(
        f"/alerts/{alert_id}/acknowledge",
        json={"coordinator_id": "COORD_001", "notes": "Checking with senior."}
    )
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "ACKNOWLEDGED"

    # Resolve
    res_res = client.post(
        f"/alerts/{alert_id}/resolve",
        json={"coordinator_id": "COORD_001", "resolution_reason": "Senior recovered after doctor review."}
    )
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"

