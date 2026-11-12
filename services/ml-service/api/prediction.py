import hmac
import os
from fastapi import APIRouter, Header, HTTPException, status

from schemas.prediction_schemas import (
    AttendancePredictionRequest,
    AttendancePredictionResponse,
    WeeklyPredictionRequest,
    WeeklyPredictionResponse,
)
from services.prediction_service import prediction_service

router = APIRouter(prefix="/prediction", tags=["prediction"])
ML_SECRET = os.getenv("ML_SERVICE_SECRET", "super-secret-ml-key-change-me")


def verify_secret(x_ml_secret: str = Header(None, alias="X-ML-Secret")):
    if not x_ml_secret or not hmac.compare_digest(x_ml_secret, ML_SECRET):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-ML-Secret header",
        )


@router.post("/attendance", response_model=AttendancePredictionResponse)
async def predict_attendance(
    request: AttendancePredictionRequest,
    x_ml_secret: str = Header(None, alias="X-ML-Secret"),
):
    verify_secret(x_ml_secret)
    return prediction_service.predict_attendance(
        meal_type=request.mealType,
        service_date=request.serviceDate,
        history=request.history,
        capacity=request.capacity or 1000,
        calendar=request.calendar,
    )


@router.post("/weekly", response_model=WeeklyPredictionResponse)
async def predict_weekly(
    request: WeeklyPredictionRequest,
    x_ml_secret: str = Header(None, alias="X-ML-Secret"),
):
    verify_secret(x_ml_secret)
    return prediction_service.predict_weekly(
        start_date=request.startDate,
        history=request.history,
        capacity=request.capacity or 1000,
        calendar=request.calendar,
    )

