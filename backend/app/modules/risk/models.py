from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Index, Integer, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TZ, Base, JSONType, created_at_col, one_of


class DailyRiskScore(Base):
    __tablename__ = "daily_risk_scores"
    __table_args__ = (
        one_of("risk_level", ("LOW", "MODERATE", "HIGH", "URGENT_REVIEW")),
        Index("ix_daily_risk_scores_date_score", "date", text("risk_score DESC")),
    )

    senior_id: Mapped[str] = mapped_column(ForeignKey("seniors.senior_id"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    risk_score: Mapped[int] = mapped_column(Integer)
    risk_level: Mapped[str] = mapped_column(Text)
    confidence_level: Mapped[str | None] = mapped_column(Text)
    baseline_confidence: Mapped[str | None] = mapped_column(Text)
    top_factors: Mapped[list] = mapped_column(JSONType, default=list)
    recommended_action: Mapped[str | None] = mapped_column(Text)
    data_quality_flags: Mapped[list] = mapped_column(JSONType, default=list)
    scoring_version: Mapped[str] = mapped_column(Text)
    computed_at: Mapped[datetime] = created_at_col()
