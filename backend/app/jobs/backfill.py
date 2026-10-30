"""Run the scoring pipeline over a date range so history exists (demo and ops charts).

    python -m app.jobs.backfill --from 2026-07-06 --to 2026-10-11 [--lists-from 2026-09-28]

Idempotent: re-running a date updates its scores and does not duplicate alerts. Writes to the
database in DATABASE_URL, so check which one that is first.
"""

import argparse
import time
from datetime import date, timedelta

from app.core.database import get_sessionmaker
from app.jobs import nightly_scoring


def run(start: date, end: date, lists_from: date | None = None) -> None:
    day = start
    while day <= end:
        t0 = time.time()
        with get_sessionmaker()() as db:
            scored = nightly_scoring.run(db, day, build_lists=lists_from is None or day >= lists_from)
        print(f"{day} {scored} ({time.time() - t0:.0f}s)", flush=True)
        day += timedelta(days=1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", type=date.fromisoformat, required=True)
    ap.add_argument("--to", dest="end", type=date.fromisoformat, required=True)
    ap.add_argument("--lists-from", type=date.fromisoformat)
    a = ap.parse_args()
    run(a.start, a.end, a.lists_from)
