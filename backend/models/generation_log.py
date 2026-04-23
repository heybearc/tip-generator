from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database.config import Base


class GenerationLog(Base):
    __tablename__ = "generation_logs"

    id            = Column(Integer, primary_key=True, index=True)
    draft_id      = Column(Integer, ForeignKey("drafts.id", ondelete="CASCADE"), nullable=False, index=True)
    event         = Column(String(64), nullable=False)
    batch_index   = Column(Integer, nullable=True)
    total_batches = Column(Integer, nullable=True)
    detail        = Column(JSONB, nullable=False, default=dict)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<GenerationLog(draft_id={self.draft_id}, event={self.event}, batch={self.batch_index})>"
