"""allow an 'unknown' speaker on call turns (mono recordings carry no speaker separation)

Revision ID: 0003
Revises: 0002
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_call_turns_speaker_valid"), "call_turns", type_="check")
    op.create_check_constraint(op.f("ck_call_turns_speaker_valid"), "call_turns",
                               "speaker IN ('agent', 'senior', 'coordinator', 'unknown')")


def downgrade() -> None:
    op.execute("UPDATE call_turns SET speaker = 'senior' WHERE speaker = 'unknown'")
    op.drop_constraint(op.f("ck_call_turns_speaker_valid"), "call_turns", type_="check")
    op.create_check_constraint(op.f("ck_call_turns_speaker_valid"), "call_turns",
                               "speaker IN ('agent', 'senior', 'coordinator')")
