"""Logging setup."""

import logging


def configure_logging(environment: str = "development") -> None:
    level = logging.INFO if environment.lower() == "production" else logging.DEBUG
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        force=True,
    )
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
