"""Pydantic schemas for SamarthCare AI Phase 2 API."""

from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str
    service: str
    timestamp: str


class SeniorProfileSummary(BaseModel):
    senior_id: str
    age: int
    preferred_language: str
    city_id: str
    living_arrangement: str
    coordinator_id: str
    expected_checkin_frequency: str
    family_consent: bool


class ContributingFactor(BaseModel):
    rule_id: str
    category: str
    evidence: str
    window: str
    points_contributed: float
    is_safety_tripwire: bool


class DailyRiskScoreResponse(BaseModel):
    senior_id: str
    date: str
    risk_score: int
    risk_level: str
    confidence_level: str
    baseline_confidence: str
    top_contributing_factors: List[Dict[str, Any]]
    recommended_action: str
    data_quality_flags: List[str]
    scoring_version: str


class AlertResponse(BaseModel):
    alert_id: str
    senior_id: str
    created_at: str
    last_updated_at: str
    status: str
    severity: str
    triggering_signals: str
    recommended_next_step: str
    resolution_reason: Optional[str] = None


class AlertAcknowledgeRequest(BaseModel):
    coordinator_id: str = Field(..., description="ID of acknowledging coordinator")
    notes: Optional[str] = Field(None, description="Optional acknowledgement notes")


class AlertResolveRequest(BaseModel):
    coordinator_id: str = Field(..., description="ID of resolving coordinator")
    resolution_reason: str = Field(..., description="Documented reason for resolution")

