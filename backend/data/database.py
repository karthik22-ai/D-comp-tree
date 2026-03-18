from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text, Boolean, DateTime, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import datetime
import os

# Use /tmp in Cloud Run environments (detected via K_SERVICE or PORT)
if os.environ.get("K_SERVICE") or os.environ.get("PORT"):
    DATABASE_URL = "sqlite:////tmp/forecasting.db"
else:
    DATABASE_URL = "sqlite:///./forecasting.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    lastAccessed = Column(DateTime, default=datetime.datetime.utcnow)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)
    state_json = Column(Text, nullable=True) # Full AppState backup

class RawImport(Base):
    __tablename__ = "raw_imports"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"))
    filename = Column(String)
    content_json = Column(Text) # Store the raw rows as JSON
    uploadedAt = Column(DateTime, default=datetime.datetime.utcnow)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
