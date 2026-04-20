"""
API Routers
"""
from .upload import router as upload_router
from .generate import router as generate_router
from .template import router as template_router

__all__ = ["upload_router", "generate_router", "template_router"]
