from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class SentimentLabel(str, Enum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"
    MIXED = "MIXED"
    UNCERTAIN = "UNCERTAIN"


class IssueType(str, Enum):
    TOO_SALTY = "TOO_SALTY"
    TOO_SPICY = "TOO_SPICY"
    COLD_FOOD = "COLD_FOOD"
    UNDERCOOKED = "UNDERCOOKED"
    OVERCOOKED = "OVERCOOKED"
    LESS_QUANTITY = "LESS_QUANTITY"
    BAD_TASTE = "BAD_TASTE"
    POOR_HYGIENE = "POOR_HYGIENE"
    CONTAMINATION = "CONTAMINATION"
    POOR_TEXTURE = "POOR_TEXTURE"


class SentimentDetail(BaseModel):
    label: SentimentLabel
    score: float = Field(..., ge=-1.0, le=1.0, description="Sentiment score from -1.0 (very negative) to +1.0 (very positive)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in the prediction")


class IssueMention(BaseModel):
    type: IssueType
    dish: Optional[str] = None


class DishMention(BaseModel):
    dish: str
    start: int
    end: int
    matchScore: float


class SentimentAnalysisRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Student feedback text")
    menuDishes: List[str] = Field(default_factory=list, description="List of dishes in the menu for matching")
    language: Optional[str] = Field(default=None, description="Optional ISO language code or hi-en")


class SentimentAnalysisResponse(BaseModel):
    sentiment: SentimentDetail
    dishes: List[DishMention] = Field(default_factory=list)
    issues: List[IssueMention] = Field(default_factory=list)
    language: str
    modelVersion: str
    analysedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ModelInfoResponse(BaseModel):
    service: str
    modelVersion: str
    trainedOn: str
    dataSource: str
    accuracy: Optional[float] = None
    classes: List[str]

