"""context_repo: unified NLP context repository with (senior_id, timestamp) PK

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    json_type = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")
    op.create_table(
        "context_repo",
        sa.Column("senior_id", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_type", sa.Text(), nullable=False, server_default="voice_note"),
        sa.Column("source_id", sa.Text(), nullable=True),
        sa.Column("raw_transcript", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("dominant_sentiment", sa.Text(), nullable=True, server_default="NEUTRAL"),
        sa.Column("extracted_signals", json_type, nullable=False, server_default=sa.text("'[]'")),
        sa.Column("talking_points", json_type, nullable=False, server_default=sa.text("'[]'")),
        sa.Column("state_transitions", json_type, nullable=False, server_default=sa.text("'[]'")),
        sa.Column("risk_score_contribution", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("requires_clinical_escalation", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("requires_operations_action", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["senior_id"], ["seniors.senior_id"], name=op.f("fk_context_repo_senior_id_seniors")),
        sa.PrimaryKeyConstraint("senior_id", "timestamp", name=op.f("pk_context_repo")),
    )
    op.create_index(op.f("ix_context_repo_senior_time"), "context_repo", ["senior_id", "timestamp"], unique=False)
    op.execute("ALTER TABLE public.context_repo ENABLE ROW LEVEL SECURITY")
    op.execute("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            REVOKE ALL ON public.context_repo FROM anon;
          END IF;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            REVOKE ALL ON public.context_repo FROM authenticated;
          END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_index(op.f("ix_context_repo_senior_time"), table_name="context_repo")
    op.drop_table("context_repo")
