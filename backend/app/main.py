from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime
from .database import init_db
from .seed_data import seed_sample_database
from .routes import items, recommendations, duplicates, shopping, outcomes, dashboard, receipt, admin, analytics, posts

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    init_db()
    # Seed initial sample data if DB is empty
    seed_sample_database(clear_first=False)
    yield

app = FastAPI(
    title="GrocIQ API",
    description="Backend API for GrocIQ — Transparent, feedback-driven grocery inventory management.",
    version="1.0.0",
    lifespan=lifespan
)

import os

# Secure CORS configuration
DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
env_origins = os.environ.get("ALLOWED_ORIGINS")
allowed_origins = [o.strip() for o in env_origins.split(",") if o.strip()] if env_origins else DEFAULT_ALLOWED_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/api/health", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "app": "GrocIQ",
        "tagline": "Smarter inventory. Less waste.",
        "team": "AXON",
        "members": ["Samarjeet Suryawanshi", "Shivanjali Desai", "Poonam Pawar", "Angel Kambale"],
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

# Register route modules
app.include_router(items.router, prefix="/api/items")
app.include_router(items.router, prefix="/items", tags=["Items Root Alias"])
app.include_router(recommendations.router)
app.include_router(duplicates.router)
app.include_router(shopping.router)
app.include_router(outcomes.router)
app.include_router(dashboard.router)
app.include_router(receipt.router, prefix="/api/receipt")
app.include_router(receipt.router, prefix="/receipts", tags=["Receipts Root Alias"])
app.include_router(analytics.router)
app.include_router(posts.router, prefix="/api")
app.include_router(posts.router, prefix="", tags=["Posts Root Alias"])
app.include_router(admin.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
