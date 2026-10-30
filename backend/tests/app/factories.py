"""Small helpers that insert users, seniors and links for tests."""

import itertools
import uuid

from app.core.security import hash_password
from app.modules.auth.models import FamilyLink, User
from app.modules.seniors.models import Senior, SeniorContact

PASSWORD = "test-password-1"
_pw_hash = hash_password(PASSWORD)
_counter = itertools.count(1)


def make_user(db, role, *, city=None, email=None, password=True, active=True, ref=None) -> User:
    n = next(_counter)
    user = User(id=uuid.uuid4(), role=role, display_name=f"{role} {n}", external_ref=ref,
                email=email or (f"{role}{n}@test.local" if role != "senior" else None),
                password_hash=_pw_hash if password and role != "senior" else None,
                city=city, is_active=active)
    db.add(user)
    db.commit()
    return user


def make_senior(db, coordinator, *, sid=None, city="Jaipur", family_level="full") -> tuple[Senior, User]:
    n = next(_counter)
    sid = sid or f"S{n:04d}"
    suser = make_user(db, "senior", ref=sid)
    senior = Senior(senior_id=sid, age=70, city=city, living_arrangement="alone",
                    preferred_language="hindi", coordinator_id=coordinator.id,
                    user_id=suser.id, family_consent_level=family_level)
    db.add(senior)
    db.add(SeniorContact(senior_id=sid, full_name="Test Person", phone="+910000000000"))
    db.commit()
    return senior, suser


def link_family(db, family_user, senior, *, level="full", consent=True) -> FamilyLink:
    link = FamilyLink(family_user_id=family_user.id, senior_id=senior.senior_id, relationship="son",
                      consent_level=level, consent_given=consent)
    db.add(link)
    db.commit()
    return link


def auth(client, email, password=PASSWORD) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---- notifications / reminders / family helpers (slice: notifications-reminders-family) ----

def make_device(db, user, token=None, platform="android"):
    from app.modules.notifications.models import DeviceToken

    dev = DeviceToken(user_id=user.id, platform=platform, token=token or f"tok-{uuid.uuid4().hex}")
    db.add(dev)
    db.commit()
    return dev


def make_schedule(db, senior, *, times=("08:00",), sos=False, active=True, start=None, end=None,
                  med_id=None):
    from datetime import date as _date

    from app.modules.medications.models import MedicationSchedule

    n = next(_counter)
    sched = MedicationSchedule(
        medication_id=med_id or f"MED_{senior.senior_id}_{n}", senior_id=senior.senior_id,
        drug_name="Drug", dosage="5 mg", criticality="high", start_date=start or _date(2026, 1, 1),
        end_date=end, times_per_day=len(times), scheduled_times=list(times), is_sos=sos,
        is_active=active)
    db.add(sched)
    db.commit()
    return sched


def senior_headers(user) -> dict:
    """Bearer header for a senior user (seniors have no password; issue the token directly)."""
    from app.modules.auth.service import _issue

    return {"Authorization": f"Bearer {_issue(user).access_token}"}


# ---- risk / alerts / priority-list helpers (appended by the risk-alerts-priority slice) ----

def make_alert(db, senior, *, status="OPEN", severity="HIGH", signals=None, step="Call today"):
    from datetime import datetime, timezone

    from app.modules.alerts.models import Alert, AlertEvent

    now = datetime.now(timezone.utc)
    alert = Alert(senior_id=senior.senior_id, created_at=now, last_updated_at=now, status=status,
                  severity=severity, triggering_signals=signals or ["Steps were low"],
                  recommended_next_step=step)
    db.add(alert)
    db.flush()
    db.add(AlertEvent(alert_id=alert.alert_id, from_status=None, to_status="OPEN", note="created", at=now))
    db.commit()
    return alert
