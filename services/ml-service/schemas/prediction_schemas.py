from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class MealType(str, Enum):
    BREAKFAST = "BREAKFAST"
    LUNCH = "LUNCH"
    SNACKS = "SNACKS"
    DINNER = "DINNER"


class ConfidenceStatus(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class PredictionSource(str, Enum):
    ML = "ML"
    BASELINE = "BASELINE"
    FALLBACK = "FALLBACK"


class AttendanceHistoryPoint(BaseModel):
    serviceDate: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    mealType: MealType
    attendance: int = Field(..., ge=0)


class AttendancePredictionRequest(BaseModel):
    mealType: MealType
    serviceDate: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    history: List[AttendanceHistoryPoint] = Field(default_factory=list)
    capacity: Optional[int] = Field(default=1000, ge=1)
    calendar: Optional[Dict[str, str]] = None  # date -> 'HOLIDAY' | 'EXAM' | 'NORMAL'


class AttendancePredictionResponse(BaseModel):
    predictedAttendance: int = Field(..., ge=0)
    lowerBound: Optional[int] = None
    upperBound: Optional[int] = None
    rangeAvailable: bool
    confidenceStatus: ConfidenceStatus
    source: PredictionSource
    modelVersion: str
    generatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class WeeklyPredictionEntry(BaseModel):
    serviceDate: str
    mealType: MealType
    predictedAttendance: int
    lowerBound: Optional[int] = None
    upperBound: Optional[int] = None
    rangeAvailable: bool
    confidenceStatus: ConfidenceStatus
    source: PredictionSource


class WeeklyPredictionRequest(BaseModel):
    startDate: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    history: List[AttendanceHistoryPoint] = Field(default_factory=list)
    capacity: Optional[int] = Field(default=1000, ge=1)
    calendar: Optional[Dict[str, str]] = None


class WeeklyPredictionResponse(BaseModel):
    predictions: List[WeeklyPredictionEntry] = Field(..., description="Exactly 21 entries: 7 days x 3 meals")
    modelVersion: str
    generatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# Quantity schemas
class ServingStandard(BaseModel):
    amountPerPerson: float = Field(..., gt=0)
    unit: str = Field(..., pattern=r"^(kg|g|l|ml|count)$")


class QuantityRecommendRequest(BaseModel):
    predictedAttendance: int = Field(..., ge=0)
    servingStandards: Dict[str, ServingStandard]
    safetyBuffer: float = Field(default=0.1, ge=0.0, le=0.5, description="Safety buffer between 0% and 50%")
    inventory: Optional[Dict[str, float]] = None


class IngredientRequirement(BaseModel):
    ingredient: str
    requiredQuantity: float
    purchaseQuantity: Optional[float] = None
    surplusQuantity: Optional[float] = None
    unit: str
    status: str  # GROSS_REQUIREMENT or PURCHASE_PLAN


class QuantityRecommendResponse(BaseModel):
    predictedAttendance: int
    safetyBuffer: float
    requirements: List[IngredientRequirement]


# Waste analysis schemas
class WasteRecordInput(BaseModel):
    ingredient: str
    preparedQuantity: float = Field(..., ge=0)
    consumedQuantity: float = Field(..., ge=0)
    leftoverQuantity: float = Field(..., ge=0)
    unit: str = Field(..., pattern=r"^(kg|g|l|ml|count)$")


class WasteAnalysisRequest(BaseModel):
    records: List[WasteRecordInput]


class IngredientWasteSummary(BaseModel):
    ingredient: str
    wastePercentage: Optional[float] = None  # null when prepared = 0
    consumptionRate: Optional[float] = None
    totalPrepared: float
    totalConsumed: float
    totalLeftover: float
    unit: str


class WasteAnalysisResponse(BaseModel):
    summary: List[IngredientWasteSummary]
    validationErrors: List[str] = Field(default_factory=list)
