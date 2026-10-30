"""Declarative base and shared column helpers."""

import uuid
from datetime import datetime

from sqlalchemy import JSON, CheckConstraint, DateTime, MetaData, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


# JSONB on Postgres, plain JSON elsewhere (keeps SQLite-based tests working).
JSONType = JSON().with_variant(JSONB(), "postgresql")
TZ = DateTime(timezone=True)


def uuid_pk():
    return mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


def created_at_col():
    return mapped_column(TZ, server_default=func.now(), nullable=False)


def one_of(column: str, values: tuple[str, ...]) -> CheckConstraint:
    """CHECK constraint restricting a text column to a fixed set of values."""
    quoted = ", ".join(f"'{v}'" for v in values)
    return CheckConstraint(f"{column} IN ({quoted})", name=f"{column}_valid")


def utcnow() -> datetime:
    return datetime.now().astimezone()
