from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api.prediction import router as prediction_router
from api.quantity import router as quantity_router
from api.sentiment import router as sentiment_router
from api.waste_analysis import router as waste_router
from services.prediction_service import prediction_service
from services.sentiment_service import sentiment_service

app = FastAPI(
    title="MessInsight ML Service",
    description="NLP Sentiment Analysis and Demand Prediction microservice for MessInsight",
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

app.include_router(sentiment_router)
app.include_router(prediction_router)
app.include_router(quantity_router)
app.include_router(waste_router)


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
        models_loaded=sentiment_service.is_loaded and prediction_service.is_loaded,
    )
