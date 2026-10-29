"""FastAPI Application for SamarthCare AI Early Warning & Decision Support."""

from contextlib import asynccontextmanager
from datetime import datetime
import json
import logging
from pathlib import Path
from typing import List, Optional
import ast
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, status

from src.api.schemas import (
    HealthResponse,
    SeniorProfileSummary,
    DailyRiskScoreResponse,
    AlertResponse,
    AlertAcknowledgeRequest,
    AlertResolveRequest,
)

logger = logging.getLogger("api")

# In-memory storage / cache for data
DATA_CACHE = {
    "profiles": None,
    "scores": None,
    "alerts": None,
}


def get_data_dir() -> Path:
    return Path("data")


def load_cached_data():
    base = get_data_dir()
    profiles_path = base / "raw" / "senior_profiles.csv"
    scores_path = base / "processed" / "daily_risk_scores.csv"
    alerts_path = base / "processed" / "alert_events.csv"

    if profiles_path.exists():
        DATA_CACHE["profiles"] = pd.read_csv(profiles_path)
    if scores_path.exists():
        DATA_CACHE["scores"] = pd.read_csv(scores_path)
    if alerts_path.exists():
        DATA_CACHE["alerts"] = pd.read_csv(alerts_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_cached_data()
    logger.info("API Startup: Cached local dataset records.")
    yield


app = FastAPI(
    title="SamarthCare AI Early Warning Decision-Support API",
    version="2.0.0",
    description="Local decision-support API for Care Coordinators monitoring senior citizen longitudinal wellbeing.",
    lifespan=lifespan
)


@app.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="healthy",
        version="2.0.0",
        service="SamarthCare AI Early Warning Decision Engine",
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )


@app.get("/seniors", response_model=List[SeniorProfileSummary])
def list_seniors(
    coordinator_id: Optional[str] = Query(None, description="Filter by Care Coordinator ID"),
    city_id: Optional[str] = Query(None, description="Filter by City ID"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    df = DATA_CACHE.get("profiles")
    if df is None:
        load_cached_data()
        df = DATA_CACHE.get("profiles")
        if df is None:
            raise HTTPException(status_code=500, detail="Senior profiles table not loaded.")

    filtered = df
    if coordinator_id:
        filtered = filtered[filtered["coordinator_id"] == coordinator_id]
    if city_id:
        filtered = filtered[filtered["city_id"] == city_id]

    paged = filtered.iloc[offset: offset + limit]
    results = []
    for _, row in paged.iterrows():
        results.append(SeniorProfileSummary(
            senior_id=row["senior_id"],
            age=int(row["age"]),
            preferred_language=row["preferred_language"],
            city_id=row["city_id"],
            living_arrangement=row["living_arrangement"],
            coordinator_id=row["coordinator_id"],
            expected_checkin_frequency=row["expected_checkin_frequency"],
            family_consent=bool(row["family_consent"]),
        ))
    return results


@app.get("/seniors/{senior_id}/latest-risk", response_model=DailyRiskScoreResponse)
def get_latest_risk(senior_id: str):
    df = DATA_CACHE.get("scores")
    if df is None:
        load_cached_data()
        df = DATA_CACHE.get("scores")
        if df is None:
            raise HTTPException(status_code=500, detail="Risk scores table not loaded.")

    senior_scores = df[df["senior_id"] == senior_id]
    if senior_scores.empty:
        raise HTTPException(status_code=404, detail=f"No risk history found for senior: {senior_id}")

    latest_row = senior_scores.sort_values("date").iloc[-1]

    # Parse top factors
    raw_factors = latest_row["top_contributing_factors"]
    try:
        factors = ast.literal_eval(raw_factors) if isinstance(raw_factors, str) else raw_factors
    except Exception:
        factors = []

    flags_raw = str(latest_row["data_quality_flags"])
    flags = [f.strip() for f in flags_raw.split(";")] if flags_raw != "None" else []

    return DailyRiskScoreResponse(
        senior_id=senior_id,
        date=latest_row["date"],
        risk_score=int(latest_row["risk_score"]),
        risk_level=latest_row["risk_level"],
        confidence_level=latest_row["confidence_level"],
        baseline_confidence=latest_row["baseline_confidence"],
        top_contributing_factors=factors,
        recommended_action=latest_row["recommended_action"],
        data_quality_flags=flags,
        scoring_version=latest_row["scoring_version"],
    )


@app.get("/seniors/{senior_id}/risk-history", response_model=List[DailyRiskScoreResponse])
def get_risk_history(
    senior_id: str,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    df = DATA_CACHE.get("scores")
    if df is None:
        load_cached_data()
        df = DATA_CACHE.get("scores")
        if df is None:
            raise HTTPException(status_code=500, detail="Risk scores table not loaded.")

    senior_scores = df[df["senior_id"] == senior_id].sort_values("date")
    if senior_scores.empty:
        raise HTTPException(status_code=404, detail=f"No risk history found for senior: {senior_id}")

    if start_date:
        senior_scores = senior_scores[senior_scores["date"] >= start_date]
    if end_date:
        senior_scores = senior_scores[senior_scores["date"] <= end_date]

    results = []
    for _, row in senior_scores.iterrows():
        raw_factors = row["top_contributing_factors"]
        try:
            factors = ast.literal_eval(raw_factors) if isinstance(raw_factors, str) else raw_factors
        except Exception:
            factors = []

        flags_raw = str(row["data_quality_flags"])
        flags = [f.strip() for f in flags_raw.split(";")] if flags_raw != "None" else []

        results.append(DailyRiskScoreResponse(
            senior_id=senior_id,
            date=row["date"],
            risk_score=int(row["risk_score"]),
            risk_level=row["risk_level"],
            confidence_level=row["confidence_level"],
            baseline_confidence=row["baseline_confidence"],
            top_contributing_factors=factors,
            recommended_action=row["recommended_action"],
            data_quality_flags=flags,
            scoring_version=row["scoring_version"],
        ))
    return results


@app.get("/alerts", response_model=List[AlertResponse])
def list_alerts(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by alert status (OPEN, ACKNOWLEDGED, ESCALATED, RESOLVED)"),
    severity: Optional[str] = Query(None, description="Filter by severity (MODERATE, HIGH, URGENT_REVIEW)")
):
    df = DATA_CACHE.get("alerts")
    if df is None:
        load_cached_data()
        df = DATA_CACHE.get("alerts")
        if df is None:
            return []

    filtered = df
    if status_filter:
        filtered = filtered[filtered["status"] == status_filter.upper()]
    if severity:
        filtered = filtered[filtered["severity"] == severity.upper()]

    results = []
    for _, row in filtered.iterrows():
        results.append(AlertResponse(
            alert_id=row["alert_id"],
            senior_id=row["senior_id"],
            created_at=row["created_at"],
            last_updated_at=row["last_updated_at"],
            status=row["status"],
            severity=row["severity"],
            triggering_signals=row["triggering_signals"],
            recommended_next_step=row["recommended_next_step"],
            resolution_reason=str(row["resolution_reason"]) if (pd.notna(row["resolution_reason"]) and str(row["resolution_reason"]) != "None") else None,
        ))
    return results


@app.get("/alerts/{alert_id}", response_model=AlertResponse)
def get_alert(alert_id: str):
    df = DATA_CACHE.get("alerts")
    if df is None:
        load_cached_data()
        df = DATA_CACHE.get("alerts")
        if df is None:
            raise HTTPException(status_code=404, detail="No alerts found.")

    match = df[df["alert_id"] == alert_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Alert not found: {alert_id}")

    row = match.iloc[0]
    return AlertResponse(
        alert_id=row["alert_id"],
        senior_id=row["senior_id"],
        created_at=row["created_at"],
        last_updated_at=row["last_updated_at"],
        status=row["status"],
        severity=row["severity"],
        triggering_signals=row["triggering_signals"],
        recommended_next_step=row["recommended_next_step"],
        resolution_reason=str(row["resolution_reason"]) if (pd.notna(row["resolution_reason"]) and str(row["resolution_reason"]) != "None") else None,
    )


@app.post("/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(alert_id: str, req: AlertAcknowledgeRequest):
    df = DATA_CACHE.get("alerts")
    if df is None:
        load_cached_data()
        df = DATA_CACHE.get("alerts")

    match = df[df["alert_id"] == alert_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Alert not found: {alert_id}")

    idx = match.index[0]
    df.at[idx, "status"] = "ACKNOWLEDGED"
    df.at[idx, "last_updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    row = df.loc[idx]
    logger.info(f"Coordinator {req.coordinator_id} acknowledged alert {alert_id}")
    return AlertResponse(
        alert_id=row["alert_id"],
        senior_id=row["senior_id"],
        created_at=row["created_at"],
        last_updated_at=row["last_updated_at"],
        status=row["status"],
        severity=row["severity"],
        triggering_signals=row["triggering_signals"],
        recommended_next_step=row["recommended_next_step"],
        resolution_reason=str(row["resolution_reason"]) if (pd.notna(row["resolution_reason"]) and str(row["resolution_reason"]) != "None") else None,
    )


@app.post("/alerts/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(alert_id: str, req: AlertResolveRequest):
    df = DATA_CACHE.get("alerts")
    if df is None:
        load_cached_data()
        df = DATA_CACHE.get("alerts")

    match = df[df["alert_id"] == alert_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Alert not found: {alert_id}")

    idx = match.index[0]
    df.at[idx, "status"] = "RESOLVED"
    df.at[idx, "last_updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    df.at[idx, "resolution_reason"] = f"Manual resolution by {req.coordinator_id}: {req.resolution_reason}"

    row = df.loc[idx]
    logger.info(f"Coordinator {req.coordinator_id} resolved alert {alert_id}: {req.resolution_reason}")
    return AlertResponse(
        alert_id=row["alert_id"],
        senior_id=row["senior_id"],
        created_at=row["created_at"],
        last_updated_at=row["last_updated_at"],
        status=row["status"],
        severity=row["severity"],
        triggering_signals=row["triggering_signals"],
        recommended_next_step=row["recommended_next_step"],
        resolution_reason=row["resolution_reason"],
    )
