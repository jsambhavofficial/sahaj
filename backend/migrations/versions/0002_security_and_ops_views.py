"""row level security, lock down API roles, ops views

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

VIEWS = {
    "v_ops_alert_response": """
        SELECT a.alert_id, a.senior_id, s.city, s.coordinator_id, a.severity, a.status, a.created_at,
               MIN(e.at) FILTER (WHERE e.to_status = 'ACKNOWLEDGED') AS first_ack_at,
               MIN(e.at) FILTER (WHERE e.to_status = 'RESOLVED') AS resolved_at,
               EXTRACT(EPOCH FROM (MIN(e.at) FILTER (WHERE e.to_status = 'ACKNOWLEDGED') - a.created_at)) / 60.0
                   AS minutes_to_ack,
               EXTRACT(EPOCH FROM (MIN(e.at) FILTER (WHERE e.to_status = 'RESOLVED') - a.created_at)) / 60.0
                   AS minutes_to_resolve
        FROM alerts a
        JOIN seniors s ON s.senior_id = a.senior_id
        LEFT JOIN alert_events e ON e.alert_id = a.alert_id
        GROUP BY a.alert_id, s.senior_id
    """,
    "v_ops_alert_volume": """
        SELECT a.created_at::date AS day, s.city, a.severity, a.status, COUNT(*) AS alerts
        FROM alerts a JOIN seniors s ON s.senior_id = a.senior_id
        GROUP BY 1, 2, 3, 4
    """,
    "v_ops_outcomes": """
        SELECT s.city, COALESCE(f.outcome, 'no_feedback') AS outcome, a.status,
               COUNT(*) AS alerts,
               COUNT(*) FILTER (WHERE f.useful) AS marked_useful
        FROM alerts a
        JOIN seniors s ON s.senior_id = a.senior_id
        LEFT JOIN alert_feedback f ON f.alert_id = a.alert_id
        GROUP BY 1, 2, 3
    """,
    "v_ops_coordinator_activity": """
        WITH ev AS (
            SELECT actor_user_id AS coordinator_id, at::date AS day, COUNT(*) AS alert_actions
            FROM alert_events WHERE actor_user_id IS NOT NULL GROUP BY 1, 2),
        c AS (
            SELECT coordinator_id, started_at::date AS day, COUNT(*) AS calls
            FROM calls WHERE coordinator_id IS NOT NULL AND started_at IS NOT NULL GROUP BY 1, 2),
        m AS (
            SELECT msg.sender_user_id AS coordinator_id, msg.created_at::date AS day, COUNT(*) AS messages_sent
            FROM messages msg JOIN users u ON u.id = msg.sender_user_id AND u.role = 'coordinator'
            GROUP BY 1, 2),
        k AS (SELECT coordinator_id, day FROM ev UNION SELECT coordinator_id, day FROM c
              UNION SELECT coordinator_id, day FROM m)
        SELECT k.coordinator_id, u.display_name, u.city, k.day,
               COALESCE(ev.alert_actions, 0) AS alert_actions,
               COALESCE(c.calls, 0) AS calls,
               COALESCE(m.messages_sent, 0) AS messages_sent
        FROM k
        JOIN users u ON u.id = k.coordinator_id
        LEFT JOIN ev ON ev.coordinator_id = k.coordinator_id AND ev.day = k.day
        LEFT JOIN c ON c.coordinator_id = k.coordinator_id AND c.day = k.day
        LEFT JOIN m ON m.coordinator_id = k.coordinator_id AND m.day = k.day
    """,
    "v_ops_alert_precision": """
        SELECT date_trunc('week', f.at)::date AS week, s.city,
               COUNT(*) AS rated, COUNT(*) FILTER (WHERE f.useful) AS useful,
               ROUND(100.0 * COUNT(*) FILTER (WHERE f.useful) / COUNT(*), 1) AS pct_useful
        FROM alert_feedback f
        JOIN alerts a ON a.alert_id = f.alert_id
        JOIN seniors s ON s.senior_id = a.senior_id
        GROUP BY 1, 2
    """,
}


def upgrade() -> None:
    # RLS on every table in public (no policies => the Supabase REST API sees nothing).
    op.execute("""
        DO $$ DECLARE r record; BEGIN
          FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
          END LOOP;
        END $$;
    """)
    for name, sql in VIEWS.items():
        op.execute(f"CREATE VIEW {name} WITH (security_invoker = true) AS {sql}")
    # Belt and braces: the API roles get no privileges on anything in public.
    op.execute("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
            REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
          END IF;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
            REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
          END IF;
        END $$;
    """)


def downgrade() -> None:
    for name in VIEWS:
        op.execute(f"DROP VIEW IF EXISTS {name}")
