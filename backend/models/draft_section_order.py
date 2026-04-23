from sqlalchemy import Column, Integer, Text, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from database.config import Base


class DraftSectionOrder(Base):
    __tablename__ = "draft_section_order"

    id          = Column(Integer, primary_key=True, index=True)
    draft_id    = Column(Integer, ForeignKey("drafts.id", ondelete="CASCADE"), nullable=False, index=True)
    section_key = Column(Text, nullable=False)
    position    = Column(Integer, nullable=False, default=0)
    visible     = Column(Boolean, nullable=False, default=True)
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("draft_id", "section_key", name="uq_draft_section_key"),)
