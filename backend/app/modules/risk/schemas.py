"""Pydantic schemas for Multimodal Risk Calculation API."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RiskCalculationRequest(BaseModel):
    senior_id: str = Field(..., description="Unique senior identifier (e.g. 'SR_1042')")
    date: Optional[str] = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%d"))

    # 1. Forecasted Vitals Signals
    bp_systolic_forecast: Optional[float] = None
    bp_diastolic_forecast: Optional[float] = None
    spo2_forecast: Optional[float] = None
    pulse_forecast: Optional[float] = None
    blood_glucose_forecast: Optional[float] = None

    # 2. Slope & Trajectory Signals
    bp_systolic_slope_3d: Optional[float] = 0.0
    spo2_slope_3d: Optional[float] = 0.0
    weight_slope_7d: Optional[float] = 0.0

    # 3. Physical Wellbeing Signals (NLP / Telemetry)
    cue_fall_incident: bool = False
    cue_acute_pain: bool = False
    cue_dizziness_vertigo: bool = False
    cue_breathlessness: bool = False
    cue_severe_weakness: bool = False
    daily_step_count_ratio: Optional[float] = None

    # 4. Psychological Wellbeing Signals (NLP)
    cue_cognitive_confusion: bool = False
    cue_severe_anxiety_panic: bool = False
    cue_loneliness_isolation: bool = False
    cue_sleep_fragmentation: bool = False

    # 5. Medication Adherence & Logistics
    med_consecutive_missed_doses: int = 0
    med_critical_omission_flag: bool = False
    med_refill_depleted: bool = False

    # 6. Assistance Required & Operational Friction
    needs_transport_escort: bool = False
    needs_daily_essentials: bool = False
    tech_app_confusion: bool = False
    service_friction_pacing: bool = False
    assistance_unresolved_aging_hours: int = 0

    # 7. Recovery / Wellbeing Moderators
    cue_recovery_confirmed: int = 0
    cue_routine_wellbeing_streak: int = 0


class ContributingFactorItem(BaseModel):
    factor_id: str
    category: str
    points: float
    description: str
    evidence: str
    urgency: str


class SynergyItem(BaseModel):
    synergy_name: str
    multiplier: float
    added_points: float
    clinical_rationale: str


class RiskCalculationResponse(BaseModel):
    senior_id: str
    date: str
    final_risk_score: int
    risk_level: str
    confidence_level: str
    sub_scores: Dict[str, float]
    active_synergies: List[SynergyItem]
    top_factors: List[ContributingFactorItem]
    requires_clinical_escalation: bool
    requires_operations_action: bool
    recommended_clinical_action: str
    recommended_operations_action: str
    safety_tripwire_triggered: bool
    data_quality_flags: List[str]
    calculation_timestamp: str
