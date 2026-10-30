"""short pairing codes: one row per 6-digit code (hashed), single use, short lived

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pairing_codes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("senior_id", sa.Text(), nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("issued_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["senior_id"], ["seniors.senior_id"], name=op.f("fk_pairing_codes_senior_id_seniors")),
        sa.ForeignKeyConstraint(["issued_by_user_id"], ["users.id"], name=op.f("fk_pairing_codes_issued_by_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pairing_codes")),
        sa.UniqueConstraint("code_hash", name=op.f("uq_pairing_codes_code_hash")),
    )
    op.create_index(op.f("ix_pairing_codes_senior_id"), "pairing_codes", ["senior_id"], unique=False)
    # Same as every other table: RLS on, no policies, so the Supabase REST API sees nothing.
    op.execute("ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY")
    op.execute("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            REVOKE ALL ON public.pairing_codes FROM anon;
          END IF;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            REVOKE ALL ON public.pairing_codes FROM authenticated;
          END IF;
        END $$;
    """)


def downgrade() -> None:
    op.drop_index(op.f("ix_pairing_codes_senior_id"), table_name="pairing_codes")
    op.drop_table("pairing_codes")
