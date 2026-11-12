import hmac
import os
from fastapi import APIRouter, Header, HTTPException, status

from schemas.prediction_schemas import (
    WasteAnalysisRequest,
    WasteAnalysisResponse,
)
from services.prediction_service import prediction_service

router = APIRouter(prefix="/waste", tags=["waste"])
ML_SECRET = os.getenv("ML_SERVICE_SECRET", "super-secret-ml-key-change-me")


def verify_secret(x_ml_secret: str = Header(None, alias="X-ML-Secret")):
    if not x_ml_secret or not hmac.compare_digest(x_ml_secret, ML_SECRET):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-ML-Secret header",
        )


@router.post("/analyze", response_model=WasteAnalysisResponse)
async def analyze_waste(
    request: WasteAnalysisRequest,
    x_ml_secret: str = Header(None, alias="X-ML-Secret"),
):
    verify_secret(x_ml_secret)
    return prediction_service.analyze_waste(request)

