"""vital_forecasts: stores daily forecasted vitals, slopes, and R_vitals score per senior

Revision ID: 0005
Revises: 0004
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    json_type = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")
    op.create_table(
        "vital_forecasts",
        sa.Column("senior_id", sa.Text(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("bp_systolic_forecast", sa.Float(), nullable=True),
        sa.Column("bp_diastolic_forecast", sa.Float(), nullable=True),
        sa.Column("pulse_forecast", sa.Float(), nullable=True),
        sa.Column("spo2_forecast", sa.Float(), nullable=True),
        sa.Column("weight_forecast", sa.Float(), nullable=True),
        sa.Column("blood_glucose_forecast", sa.Float(), nullable=True),
        sa.Column("bp_systolic_slope_3d", sa.Float(), nullable=True),
        sa.Column("spo2_slope_3d", sa.Float(), nullable=True),
        sa.Column("weight_slope_7d", sa.Float(), nullable=True),
        sa.Column("r_vitals_score", sa.Float(), nullable=True),
        sa.Column("contributions", json_type, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("forecasts_detail", json_type, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("model_version", sa.Text(), nullable=False, server_default="vitals_v1"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["senior_id"], ["seniors.senior_id"], name=op.f("fk_vital_forecasts_senior_id_seniors")),
        sa.PrimaryKeyConstraint("senior_id", "date", name=op.f("pk_vital_forecasts")),
    )
    op.create_index(op.f("ix_vital_forecasts_date"), "vital_forecasts", ["date"], unique=False)
    op.execute("ALTER TABLE public.vital_forecasts ENABLE ROW LEVEL SECURITY")
    op.execute("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            REVOKE ALL ON public.vital_forecasts FROM anon;
          END IF;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            REVOKE ALL ON public.vital_forecasts FROM authenticated;
          END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_index(op.f("ix_vital_forecasts_date"), table_name="vital_forecasts")
    op.drop_table("vital_forecasts")
