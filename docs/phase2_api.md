# SamarthCare AI — Phase 2 FastAPI Backend Documentation

The SamarthCare AI Decision Support API provides local, high-performance REST endpoints to query senior profiles, longitudinal risk histories, active alerts, and perform human coordinator triage actions (acknowledgment and resolution).

---

## 1. Starting the API Server

From the repository root:

```bash
uvicorn src.api.main:app --reload --port 8000
```
Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

---

## 2. API Endpoints

### 2.1 System Health
- **`GET /health`**
- **Response**:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "service": "SamarthCare AI Early Warning Decision Engine",
  "timestamp": "2026-10-29 08:00:00"
}
```

---

### 2.2 Senior Profiles
- **`GET /seniors?limit=50&offset=0&coordinator_id=COORD_001`**
- **Response**:
```json
[
  {
    "senior_id": "S0001",
    "age": 73,
    "preferred_language": "hindi",
    "city_id": "CITY_DELHI",
    "living_arrangement": "alone",
    "coordinator_id": "COORD_001",
    "expected_checkin_frequency": "daily",
    "family_consent": true
  }
]
```

---

### 2.3 Latest Risk Score
- **`GET /seniors/{senior_id}/latest-risk`**
- **Response**:
```json
{
  "senior_id": "S0015",
  "date": "2026-02-15",
  "risk_score": 100,
  "risk_level": "URGENT_REVIEW",
  "confidence_level": "HIGH",
  "baseline_confidence": "HIGH",
  "top_contributing_factors": [
    {
      "rule_id": "RULE_ACUTE_FALL",
      "category": "acute_safety",
      "evidence": "Senior or coordinator check-in note confirmed an acute slip or fall incident.",
      "window": "Past 24-72 hours",
      "points_contributed": 80.0,
      "is_safety_tripwire": true
    }
  ],
  "recommended_action": "Care Coordinator must immediately contact senior or local emergency contact, assess for injury, and initiate post-fall safety protocol.",
  "data_quality_flags": [],
  "scoring_version": "2.0.0"
}
```

---

### 2.4 Risk History
- **`GET /seniors/{senior_id}/risk-history?start_date=2026-01-01&end_date=2026-01-14`**
- Returns time-series of daily scores and contributing factors.

---

### 2.5 Active Alerts
- **`GET /alerts?status=OPEN&severity=URGENT_REVIEW`**
- **Response**:
```json
[
  {
    "alert_id": "ALT_00012",
    "senior_id": "S0015",
    "created_at": "2026-02-15",
    "last_updated_at": "2026-02-15",
    "status": "OPEN",
    "severity": "URGENT_REVIEW",
    "triggering_signals": "Senior or coordinator check-in note confirmed an acute slip or fall incident.",
    "recommended_next_step": "Care Coordinator must immediately contact senior or local emergency contact, assess for injury, and initiate post-fall safety protocol.",
    "resolution_reason": null
  }
]
```

---

### 2.6 Coordinator Workflow Actions

#### Acknowledge Alert
- **`POST /alerts/{alert_id}/acknowledge`**
- **Payload**:
```json
{
  "coordinator_id": "COORD_001",
  "notes": "Initiated phone check-in with senior; checking injury status."
}
```

#### Resolve Alert
- **`POST /alerts/{alert_id}/resolve`**
- **Payload**:
```json
{
  "coordinator_id": "COORD_001",
  "resolution_reason": "Senior reviewed by local medical officer. Stable with no fracture; family informed."
}
```

