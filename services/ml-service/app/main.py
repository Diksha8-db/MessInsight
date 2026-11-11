from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="MessInsight ML Service",
    description="NLP and Demand Prediction microservice for MessInsight",
    version="0.1.0",
)

# Closed CORS policy: Browser never calls ML service directly. Next.js backend is the only gateway.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],  # direct browser access prohibited
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    version: str
    models_loaded: bool


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Service health endpoint."""
    return HealthResponse(
        status="UP",
        service="messinsight-ml-service",
        timestamp=datetime.now(timezone.utc).isoformat(),
        version="0.1.0",
        models_loaded=False,  # Loaded in subsequent ML phases
    )

