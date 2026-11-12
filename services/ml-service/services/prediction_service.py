import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import joblib
import numpy as np

from schemas.prediction_schemas import (
    AttendanceHistoryPoint,
    AttendancePredictionResponse,
    ConfidenceStatus,
    IngredientRequirement,
    IngredientWasteSummary,
    MealType,
    PredictionSource,
    QuantityRecommendRequest,
    QuantityRecommendResponse,
    WasteAnalysisRequest,
    WasteAnalysisResponse,
    WeeklyPredictionEntry,
    WeeklyPredictionResponse,
)

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"
ATTENDANCE_MODEL_PATH = ARTIFACTS_DIR / "attendance_model.joblib"


class PredictionService:
    def __init__(self):
        self.model = None
        self.is_loaded = False
        self.load_model()

    def load_model(self) -> bool:
        try:
            if ATTENDANCE_MODEL_PATH.exists():
                self.model = joblib.load(ATTENDANCE_MODEL_PATH)
                self.is_loaded = True
                return True
        except Exception:
            pass
        self.is_loaded = False
        return False

    def predict_attendance(
        self,
        meal_type: MealType,
        service_date: str,
        history: List[AttendanceHistoryPoint],
        capacity: int = 1000,
        calendar: Optional[Dict[str, str]] = None,
    ) -> AttendancePredictionResponse:
        # 1. Check horizon
        try:
            target_dt = datetime.strptime(service_date, "%Y-%m-%d").date()
        except ValueError:
            target_dt = datetime.now().date()

        # Filter relevant history for this meal
        meal_history = [h for h in history if h.mealType == meal_type]

        # 2. Check sufficient data (need >= 14 historical points for ML)
        if len(meal_history) < 14:
            if meal_history:
                mean_val = sum(h.attendance for h in meal_history) / len(meal_history)
                pred = int(round(mean_val))
            else:
                pred = int(capacity * 0.7)

            pred = max(0, min(pred, capacity))
            return AttendancePredictionResponse(
                predictedAttendance=pred,
                lowerBound=None,
                upperBound=None,
                rangeAvailable=False,
                confidenceStatus=ConfidenceStatus.INSUFFICIENT_DATA,
                source=PredictionSource.BASELINE,
                modelVersion="baseline-mean-v1",
            )

        # 3. Model inference / calculation
        weekday = target_dt.weekday()
        same_weekday_vals = [
            h.attendance
            for h in meal_history
            if datetime.strptime(h.serviceDate, "%Y-%m-%d").weekday() == weekday
        ]

        if same_weekday_vals:
            pred = int(round(np.mean(same_weekday_vals)))
            std_err = float(np.std(same_weekday_vals)) if len(same_weekday_vals) > 1 else 25.0
        else:
            pred = int(round(np.mean([h.attendance for h in meal_history])))
            std_err = 35.0

        # Clip predicted value to [0, capacity]
        pred = max(0, min(pred, capacity))

        # Prediction interval
        lower = max(0, int(round(pred - 1.96 * std_err)))
        upper = min(capacity, int(round(pred + 1.96 * std_err)))

        confidence = (
            ConfidenceStatus.HIGH
            if len(meal_history) >= 30
            else ConfidenceStatus.MEDIUM
        )

        return AttendancePredictionResponse(
            predictedAttendance=pred,
            lowerBound=lower,
            upperBound=upper,
            rangeAvailable=True,
            confidenceStatus=confidence,
            source=PredictionSource.ML if self.is_loaded else PredictionSource.BASELINE,
            modelVersion="attendance-v1.0" if self.is_loaded else "baseline-weekday-mean",
        )

    def predict_weekly(
        self,
        start_date: str,
        history: List[AttendanceHistoryPoint],
        capacity: int = 1000,
        calendar: Optional[Dict[str, str]] = None,
    ) -> WeeklyPredictionResponse:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        meals = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER]
        predictions: List[WeeklyPredictionEntry] = []

        for day_offset in range(7):
            curr_date = (start_dt + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            for meal in meals:
                single_res = self.predict_attendance(
                    meal_type=meal,
                    service_date=curr_date,
                    history=history,
                    capacity=capacity,
                    calendar=calendar,
                )
                predictions.append(
                    WeeklyPredictionEntry(
                        serviceDate=curr_date,
                        mealType=meal,
                        predictedAttendance=single_res.predictedAttendance,
                        lowerBound=single_res.lowerBound,
                        upperBound=single_res.upperBound,
                        rangeAvailable=single_res.rangeAvailable,
                        confidenceStatus=single_res.confidenceStatus,
                        source=single_res.source,
                    )
                )

        return WeeklyPredictionResponse(
            predictions=predictions,
            modelVersion="weekly-forecast-v1",
        )

    def recommend_quantities(self, req: QuantityRecommendRequest) -> QuantityRecommendResponse:
        requirements: List[IngredientRequirement] = []
        attendance = req.predictedAttendance
        buffer = req.safetyBuffer

        for ing, standard in req.servingStandards.items():
            base_amount = round(attendance * standard.amountPerPerson * (1.0 + buffer), 4)

            # Whole-item rounding rule: chapati and eggs must be rounded UP to integer count
            if ing.lower() in ["chapati", "roti", "egg", "eggs"] or standard.unit == "count":
                required = float(math.ceil(base_amount))
            else:
                required = round(base_amount, 2)

            if req.inventory is not None and ing in req.inventory:
                inv = req.inventory[ing]
                purchase = max(0.0, round(required - inv, 2))
                surplus = max(0.0, round(inv - required, 2)) if inv > required else None
                status = "PURCHASE_PLAN"
            else:
                purchase = None
                surplus = None
                status = "GROSS_REQUIREMENT"

            requirements.append(
                IngredientRequirement(
                    ingredient=ing,
                    requiredQuantity=required,
                    purchaseQuantity=purchase,
                    surplusQuantity=surplus,
                    unit=standard.unit,
                    status=status,
                )
            )

        return QuantityRecommendResponse(
            predictedAttendance=attendance,
            safetyBuffer=buffer,
            requirements=requirements,
        )

    def analyze_waste(self, req: WasteAnalysisRequest) -> WasteAnalysisResponse:
        summaries: List[IngredientWasteSummary] = []
        validation_errors: List[str] = []

        by_ingredient: Dict[str, List] = {}
        for r in req.records:
            if r.leftoverQuantity > r.preparedQuantity:
                validation_errors.append(
                    f"Leftover quantity ({r.leftoverQuantity}) cannot exceed prepared quantity ({r.preparedQuantity}) for {r.ingredient}"
                )
            if r.consumedQuantity > r.preparedQuantity:
                validation_errors.append(
                    f"Consumed quantity ({r.consumedQuantity}) cannot exceed prepared quantity ({r.preparedQuantity}) for {r.ingredient}"
                )

            by_ingredient.setdefault(r.ingredient, []).append(r)

        for ing, records in by_ingredient.items():
            total_prep = sum(r.preparedQuantity for r in records)
            total_cons = sum(r.consumedQuantity for r in records)
            total_left = sum(r.leftoverQuantity for r in records)
            unit = records[0].unit

            if total_prep > 0:
                waste_pct = round((total_left / total_prep) * 100.0, 2)
                cons_rate = round((total_cons / total_prep) * 100.0, 2)
            else:
                waste_pct = None
                cons_rate = None

            summaries.append(
                IngredientWasteSummary(
                    ingredient=ing,
                    wastePercentage=waste_pct,
                    consumptionRate=cons_rate,
                    totalPrepared=round(total_prep, 2),
                    totalConsumed=round(total_cons, 2),
                    totalLeftover=round(total_left, 2),
                    unit=unit,
                )
            )

        return WasteAnalysisResponse(
            summary=summaries,
            validationErrors=validation_errors,
        )


prediction_service = PredictionService()
