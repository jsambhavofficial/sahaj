"""notification_preferences table and the wider set of notification kinds

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

OLD_KINDS = ("medication_reminder", "checkin_prompt", "alert_new", "alert_escalated",
             "priority_list_updated", "message_received", "call_summary_ready")
NEW_KINDS = OLD_KINDS + (
    "daily_wellbeing", "ai_saathi", "caretaker_visit", "appointment_reminder", "care_update",
    "wellbeing_concern", "senior_assigned", "ai_concern_review", "missed_checkin",
    "pending_followup", "overdue_visit", "family_observation", "escalation", "followup_update",
)
CONSTRAINT = "ck_notifications_kind_valid"


def _kinds_check(kinds: tuple[str, ...]) -> str:
    return "kind IN (" + ", ".join(f"'{k}'" for k in kinds) + ")"


def upgrade() -> None:
    # idempotent: the DDL may already have been applied by hand while another 0006 revision owned alembic_version
    if sa.inspect(op.get_bind()).has_table("notification_preferences"):
        op.execute(f"ALTER TABLE notifications DROP CONSTRAINT IF EXISTS {CONSTRAINT}")
        op.create_check_constraint(op.f(CONSTRAINT), "notifications", _kinds_check(NEW_KINDS))
        return
    json_type = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")
    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("preferences", json_type, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_notification_preferences_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notification_preferences")),
        sa.UniqueConstraint("user_id", name=op.f("uq_notification_preferences_user_id")),
    )
    op.create_index(op.f("ix_notification_preferences_user_id"), "notification_preferences", ["user_id"], unique=True)

    op.drop_constraint(op.f(CONSTRAINT), "notifications", type_="check")
    op.create_check_constraint(op.f(CONSTRAINT), "notifications", _kinds_check(NEW_KINDS))


def downgrade() -> None:
    # rows with the newer kinds would violate the old constraint
    op.execute("DELETE FROM notifications WHERE kind NOT IN (%s)" % ", ".join(f"'{k}'" for k in OLD_KINDS))
    op.drop_constraint(op.f(CONSTRAINT), "notifications", type_="check")
    op.create_check_constraint(op.f(CONSTRAINT), "notifications", _kinds_check(OLD_KINDS))
    op.drop_index(op.f("ix_notification_preferences_user_id"), table_name="notification_preferences")
    op.drop_table("notification_preferences")
