"""
TIP Generator - FastAPI Backend
AI-powered Technical Implementation Plan generator
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import Base, engine, get_db
import models  # Import models to register them with Base
from routers import upload_router, generate_router, template_router, release_notes_router, auth_router, admin_router, library_router
import os

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TIP Generator API",
    description="AI-powered Technical Implementation Plan generator using Claude API",
    version="0.2.0",
    redirect_slashes=False,
)

# Include routers
app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(generate_router)
app.include_router(template_router)
app.include_router(release_notes_router)
app.include_router(admin_router)
app.include_router(library_router)

@app.on_event("startup")
async def startup_event():
    """Create default user if not exists"""
    from models.user import User
    from database import SessionLocal
    
    db = SessionLocal()
    try:
        # Check if default user exists
        user = db.query(User).filter(User.id == 1).first()
        if not user:
            # Create default user
            user = User(
                id=1,
                email="admin@tip-generator.local",
                username="admin",
                full_name="TIP Generator Admin",
                is_active=True,
                is_superuser=True
            )
            db.add(user)
            db.commit()
            print("✅ Created default user (id=1)")
    finally:
        db.close()

# Configure CORS
cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "TIP Generator API",
        "version": "0.3.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "service": "tip-generator"
    }

@app.get("/api/health")
async def api_health(db: Session = Depends(get_db)):
    """
    Health check with database connectivity test
    """
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "healthy",
        "api_version": "v1",
        "database": db_status
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
