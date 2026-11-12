import hmac
import os
from fastapi import APIRouter, Header, HTTPException, status
from schemas.nlp_schemas import (
    ModelInfoResponse,
    SentimentAnalysisRequest,
    SentimentAnalysisResponse,
)
from services.sentiment_service import sentiment_service

router = APIRouter(prefix="/sentiment", tags=["sentiment"])

ML_SECRET = os.getenv("ML_SERVICE_SECRET", "super-secret-ml-key-change-me")


def verify_secret(x_ml_secret: str = Header(None, alias="X-ML-Secret")):
    if not x_ml_secret or not hmac.compare_digest(x_ml_secret, ML_SECRET):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-ML-Secret header",
        )


@router.post("/analyze", response_model=SentimentAnalysisResponse)
async def analyze_sentiment(
    request: SentimentAnalysisRequest,
    x_ml_secret: str = Header(None, alias="X-ML-Secret"),
):
    verify_secret(x_ml_secret)

    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Feedback text cannot be empty or whitespace",
        )

    sentiment, dishes, issues, lang, model_ver = sentiment_service.analyze(
        text=request.text,
        menu_dishes=request.menuDishes,
        language=request.language,
    )

    return SentimentAnalysisResponse(
        sentiment=sentiment,
        dishes=dishes,
        issues=issues,
        language=lang,
        modelVersion=model_ver,
    )


@router.get("/info", response_model=ModelInfoResponse)
async def get_model_info():
    metadata = sentiment_service.metadata
    return ModelInfoResponse(
        service="messinsight-nlp-sentiment",
        modelVersion=metadata.get("modelVersion", "v1.0-baseline"),
        trainedOn=metadata.get("trainedOn", "2026-11-12"),
        dataSource=metadata.get("dataSource", "synthetic"),
        accuracy=metadata.get("testAccuracy", 0.88),
        classes=["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED", "UNCERTAIN"],
    )

