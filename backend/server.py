"""
Medina County BC Staffing - Main FastAPI Application

This is the main entry point that registers all modular routers.
The application has been refactored from a 4000+ line monolithic file
into separate route modules for better maintainability.
"""
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import os
import logging

from database import shutdown_db_client

# Import all route modules
from routes.auth_routes import router as auth_router
from routes.personnel_routes import router as personnel_router
from routes.stations_routes import router as stations_router
from routes.staffing_routes import router as staffing_router
from routes.volunteer_routes import router as volunteer_router
from routes.parttime_routes import router as parttime_router
from routes.overtime_routes import router as overtime_router
from routes.deployments_routes import router as deployments_router
from routes.users_routes import router as users_router
from routes.notifications_routes import router as notifications_router
from routes.reports_routes import router as reports_router
from routes.misc_routes import router as misc_router
from routes.websocket_routes import router as websocket_router

# Initialize FastAPI app
app = FastAPI(
    title="Medina County BC Staffing API",
    description="Fire Department Staffing Management System",
    version="2.0.0"
)

# Register all routers under /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(personnel_router, prefix="/api")
app.include_router(stations_router, prefix="/api")
app.include_router(staffing_router, prefix="/api")
app.include_router(volunteer_router, prefix="/api")
app.include_router(parttime_router, prefix="/api")
app.include_router(overtime_router, prefix="/api")
app.include_router(deployments_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(misc_router, prefix="/api")
app.include_router(websocket_router, prefix="/api")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_event():
    await shutdown_db_client()


# Root endpoint for basic health check
@app.get("/")
async def root():
    return {
        "message": "Medina County BC Staffing API",
        "version": "2.0.0",
        "docs": "/docs"
    }
