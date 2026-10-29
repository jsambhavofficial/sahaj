"""Comprehensive API endpoint verification across all registered modules: voice, checkins, and risk."""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]
ml_dir = backend_dir / "ml"
for p in (backend_dir, ml_dir):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from app.main import app
from app.modules.voice.router import process_voice_note, get_talking_points
from app.modules.voice.schemas import VoiceNoteProcessRequest
from app.modules.voice.service import VoiceNoteService

from app.modules.checkins.router import process_call
from app.modules.checkins.schemas import CallProcessRequest, CallTurn
from app.modules.checkins.service import CallProcessingService

from app.modules.risk.router import calculate_risk_score
from app.modules.risk.schemas import RiskCalculationRequest
from app.modules.risk.service import RiskScoringService


def verify_all_endpoints():
    print("==================================================")
    print("1. Verifying Registered API Routes in FastAPI")
    print("==================================================")
    openapi = app.openapi()
    paths = openapi.get("paths", {})
    for path, methods in sorted(paths.items()):
        print(f"  {path} -> {list(methods.keys())}")

    assert "/api/v1/voice/process-note" in paths
    assert "/api/v1/voice/talking-points/{senior_id}" in paths
    assert "/api/v1/checkins/process-call" in paths
    assert "/api/v1/risk/calculate-score" in paths
    print("All 4 API routes registered successfully!")

    print("\n==================================================")
    print("2. Testing POST /api/v1/voice/process-note")
    print("==================================================")
    voice_svc = VoiceNoteService()
    v_req = VoiceNoteProcessRequest(
        senior_id="SR_1042",
        transcript="Coordinator jaldi bolti hain. Aur subah sir ghoom raha tha chakkar aaya.",
        provider="mock"
    )
    v_res = process_voice_note(v_req, service=voice_svc)
    print(f"Voice Response: Senior={v_res.senior_id}, Delta={v_res.total_nlp_risk_delta}, Events={len(v_res.events)}")
    assert v_res.total_nlp_risk_delta > 0

    print("\n==================================================")
    print("3. Testing POST /api/v1/checkins/process-call")
    print("==================================================")
    call_svc = CallProcessingService()
    c_req = CallProcessRequest(
        senior_id="SR_1042",
        provider="mock",
        turns=[
            CallTurn(speaker="Coordinator", text="Chakkar kaisa hai aaj?"),
            CallTurn(speaker="Senior", text="Nahi beta, koi chakkar nahi aaya theek hu.")
        ]
    )
    c_res = process_call(c_req, service=call_svc)
    print(f"Call Response: Transitions={len(c_res.state_transitions)}, Delta={c_res.total_call_risk_delta}")
    assert any(t.new_status == "RESOLVED" for t in c_res.state_transitions)

    print("\n==================================================")
    print("4. Testing POST /api/v1/risk/calculate-score")
    print("==================================================")
    risk_svc = RiskScoringService()
    r_req = RiskCalculationRequest(
        senior_id="SR_1042",
        bp_systolic_forecast=162.0,
        bp_systolic_slope_3d=7.0,
        cue_dizziness_vertigo=True,
        med_consecutive_missed_doses=2,
        med_critical_omission_flag=True,
        needs_transport_escort=True
    )
    r_res = calculate_risk_score(r_req, service=risk_svc)
    print(f"Risk Response: Final Score={r_res.final_risk_score} | Level={r_res.risk_level}")
    print(f"Clinical Escalation: {r_res.requires_clinical_escalation} | Ops Action: {r_res.requires_operations_action}")
    print(f"Active Synergies: {[s.synergy_name for s in r_res.active_synergies]}")
    print(f"Clinical Rec: {r_res.recommended_clinical_action}")
    print(f"Ops Rec: {r_res.recommended_operations_action}")
    assert r_res.final_risk_score >= 70
    assert r_res.requires_clinical_escalation is True
    assert r_res.requires_operations_action is True

    print("\n==================================================")
    print("ALL API ENDPOINTS & MODULE SERVICES VERIFIED 100%!")
    print("==================================================")


if __name__ == "__main__":
    verify_all_endpoints()
