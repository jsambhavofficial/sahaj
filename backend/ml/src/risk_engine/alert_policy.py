"""Alert lifecycle management, deduplication, escalation, and resolution policy."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd


@dataclass
class AlertRecord:
    alert_id: str
    senior_id: str
    created_at: str
    last_updated_at: str
    status: str  # "OPEN", "ACKNOWLEDGED", "ESCALATED", "RESOLVED"
    severity: str  # "MODERATE", "HIGH", "URGENT_REVIEW"
    triggering_signals: str
    recommended_next_step: str
    resolution_reason: Optional[str] = None
    audit_history: List[Dict[str, Any]] = field(default_factory=list)


class AlertLifecyclePolicy:
    """
    Manages clinical alert states, deduplication, escalation, resolution,
    and audit tracking across daily risk scores.
    """

    SEVERITY_ORDER = {
        "LOW": 0,
        "MODERATE": 1,
        "HIGH": 2,
        "URGENT_REVIEW": 3,
    }

    def __init__(self, alert_threshold: int = 50, resolution_days_required: int = 3):
        self.alert_threshold = alert_threshold
        self.resolution_days_required = resolution_days_required
        self.active_alerts: Dict[str, AlertRecord] = {}  # senior_id -> active AlertRecord
        self.closed_alerts: List[AlertRecord] = []
        self.all_alert_events: List[AlertRecord] = []
        self.low_score_streaks: Dict[str, int] = {}  # senior_id -> consecutive low score days
        self.alert_counter = 1

    def process_daily_score(
        self,
        senior_id: str,
        date_str: str,
        risk_score: int,
        risk_level: str,
        top_factors: List[Dict[str, Any]],
        recommended_action: str
    ) -> Optional[AlertRecord]:
        """
        Evaluates a senior's daily score against alert state rules.
        Handles new alerts, ongoing deduplication, escalation, and resolution.
        """
        active = self.active_alerts.get(senior_id)
        has_safety_tripwire = any(f.get("is_safety_tripwire", False) for f in top_factors)
        is_alert_worthy = (risk_score >= self.alert_threshold) or has_safety_tripwire

        factor_evidences = [f.get("evidence", "") for f in top_factors if f.get("evidence")]
        trigger_desc = "; ".join(factor_evidences) if factor_evidences else f"Elevated score ({risk_score})"

        if is_alert_worthy:
            self.low_score_streaks[senior_id] = 0

            if active is None:
                # 1. New Alert
                alert_id = f"ALT_{self.alert_counter:05d}"
                self.alert_counter += 1
                new_alert = AlertRecord(
                    alert_id=alert_id,
                    senior_id=senior_id,
                    created_at=date_str,
                    last_updated_at=date_str,
                    status="OPEN",
                    severity=risk_level,
                    triggering_signals=trigger_desc,
                    recommended_next_step=recommended_action,
                    resolution_reason=None,
                    audit_history=[{
                        "date": date_str,
                        "action": "CREATED",
                        "score": risk_score,
                        "level": risk_level,
                        "reason": "Risk crossed threshold."
                    }]
                )
                self.active_alerts[senior_id] = new_alert
                self.all_alert_events.append(new_alert)
                return new_alert

            else:
                # 2. Existing Alert - Check for Escalation or Duplicate Suppression
                active_level_val = self.SEVERITY_ORDER.get(active.severity, 1)
                new_level_val = self.SEVERITY_ORDER.get(risk_level, 1)

                is_escalation = (new_level_val > active_level_val) or (has_safety_tripwire and active.severity != "URGENT_REVIEW")

                if is_escalation:
                    # Escalate active alert
                    active.severity = risk_level
                    active.last_updated_at = date_str
                    active.status = "ESCALATED"
                    active.triggering_signals = trigger_desc
                    active.recommended_next_step = recommended_action
                    active.audit_history.append({
                        "date": date_str,
                        "action": "ESCALATED",
                        "score": risk_score,
                        "level": risk_level,
                        "reason": "Risk severity increased."
                    })
                    return active
                else:
                    # Ongoing alert continuation - Duplicate Suppressed!
                    active.last_updated_at = date_str
                    # Update recommendation if fresh
                    active.recommended_next_step = recommended_action
                    active.audit_history.append({
                        "date": date_str,
                        "action": "CONTINUING_SUPPRESSED",
                        "score": risk_score,
                        "level": risk_level,
                        "reason": "Ongoing condition; duplicate alert suppressed."
                    })
                    return None

        else:
            # Score is below alert threshold (<50)
            if active is not None:
                streak = self.low_score_streaks.get(senior_id, 0) + 1
                self.low_score_streaks[senior_id] = streak

                # Requires sustained improvement (e.g. 3 consecutive days below threshold)
                if streak >= self.resolution_days_required:
                    # Resolve the alert
                    active.status = "RESOLVED"
                    active.last_updated_at = date_str
                    active.resolution_reason = f"Sustained improvement: risk score below threshold for {streak} consecutive days."
                    active.audit_history.append({
                        "date": date_str,
                        "action": "RESOLVED",
                        "score": risk_score,
                        "level": risk_level,
                        "reason": active.resolution_reason
                    })
                    self.closed_alerts.append(active)
                    del self.active_alerts[senior_id]
                    self.low_score_streaks[senior_id] = 0
            else:
                self.low_score_streaks[senior_id] = 0

            return None

    def export_alerts_dataframe(self) -> pd.DataFrame:
        """Returns all generated alert events as a DataFrame."""
        rows = []
        for alert in self.all_alert_events:
            rows.append({
                "alert_id": alert.alert_id,
                "senior_id": alert.senior_id,
                "created_at": alert.created_at,
                "last_updated_at": alert.last_updated_at,
                "status": alert.status,
                "severity": alert.severity,
                "triggering_signals": alert.triggering_signals,
                "recommended_next_step": alert.recommended_next_step,
                "resolution_reason": alert.resolution_reason if alert.resolution_reason else "None",
            })
        return pd.DataFrame(rows)


def run_alert_policy_on_scores(scores_df: pd.DataFrame) -> pd.DataFrame:
    """Executes the alert lifecycle policy across sorted daily risk scores."""
    policy = AlertLifecyclePolicy(alert_threshold=50, resolution_days_required=3)
    sorted_df = scores_df.sort_values(["senior_id", "date"])

    for _, row in sorted_df.iterrows():
        # Parse top_contributing_factors safely
        raw_factors = row.get("top_contributing_factors", "[]")
        if isinstance(raw_factors, str):
            try:
                import ast
                factors = ast.literal_eval(raw_factors)
            except Exception:
                factors = []
        else:
            factors = raw_factors if isinstance(raw_factors, list) else []

        policy.process_daily_score(
            senior_id=row["senior_id"],
            date_str=row["date"],
            risk_score=int(row["risk_score"]),
            risk_level=row["risk_level"],
            top_factors=factors,
            recommended_action=row["recommended_action"],
        )

    return policy.export_alerts_dataframe()

