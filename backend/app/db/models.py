"""Imports every model so Base.metadata is complete (used by Alembic and tests)."""

from app.db.base import Base  # noqa: F401
from app.modules.alerts.models import Alert, AlertEvent, AlertFeedback  # noqa: F401
from app.modules.auth.models import AuditLog, FamilyLink, PairingCode, User  # noqa: F401
from app.modules.checkins.models import Checkin, NlpCue  # noqa: F401
from app.modules.coordinators.models import PriorityList, PriorityListItem  # noqa: F401
from app.modules.family.models import FamilyInteraction, WeeklyFamilySummary  # noqa: F401
from app.modules.medications.models import MedicationEvent, MedicationSchedule  # noqa: F401
from app.modules.messages.models import Message  # noqa: F401
from app.modules.notifications.models import DeviceToken, Notification  # noqa: F401
from app.modules.risk.models import DailyRiskScore  # noqa: F401
from app.modules.seniors.models import (  # noqa: F401
    Senior, SeniorBaseline, SeniorCondition, SeniorContact, SeniorHealthProfile,
)
from app.modules.vitals.models import AccelerometerWindow, DailyActivity, Vital, VitalForecast  # noqa: F401
from app.modules.voice.models import Call, CallTurn, ContextRepo, SeniorMemoryItem  # noqa: F401
