"""
Template model for TIP templates
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, JSON
from sqlalchemy.sql import func
from database.config import Base

class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    
    # Template structure
    sections = Column(JSON, nullable=False)  # Ordered list of section definitions
    prompt_template = Column(Text, nullable=False)  # Claude prompt template
    
    # Metadata
    version = Column(String, default="1.0")
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Template(id={self.id}, name={self.name}, version={self.version})>"
