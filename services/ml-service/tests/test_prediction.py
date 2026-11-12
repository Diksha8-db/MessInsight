import pytest
from services.prediction_service import prediction_service
from schemas.prediction_schemas import (
    AttendanceHistoryPoint,
    MealType,
    ConfidenceStatus,
    PredictionSource,
    QuantityRecommendRequest,
    ServingStandard,
    WasteAnalysisRequest,
    WasteRecordInput,
)


def test_pred_01_insufficient_history_returns_baseline():
    res = prediction_service.predict_attendance(
        meal_type=MealType.LUNCH,
        service_date="2026-11-20",
        history=[],
        capacity=500,
    )
    assert res.confidenceStatus == ConfidenceStatus.INSUFFICIENT_DATA
    assert res.source == PredictionSource.BASELINE
    assert 0 <= res.predictedAttendance <= 500


def test_pred_02_bounds_invariants():
    history = [
        AttendanceHistoryPoint(serviceDate=f"2026-10-{i:02d}", mealType=MealType.LUNCH, attendance=450 + (i % 20))
        for i in range(1, 31)
    ]
    res = prediction_service.predict_attendance(
        meal_type=MealType.LUNCH,
        service_date="2026-11-20",
        history=history,
        capacity=600,
    )
    assert res.rangeAvailable is True
    assert res.lowerBound is not None and res.upperBound is not None
    assert 0 <= res.lowerBound <= res.predictedAttendance <= res.upperBound <= 600


def test_pred_03_weekly_forecast_returns_21_entries():
    res = prediction_service.predict_weekly(
        start_date="2026-11-20",
        history=[],
        capacity=500,
    )
    assert len(res.predictions) == 21
    # Check that each day has 3 meals: BREAKFAST, LUNCH, DINNER
    dates = {p.serviceDate for p in res.predictions}
    assert len(dates) == 7


def test_qty_01_quantity_formula_and_chapati_rounding():
    req = QuantityRecommendRequest(
        predictedAttendance=100,
        servingStandards={
            "Rice": ServingStandard(amountPerPerson=0.15, unit="kg"),
            "Chapati": ServingStandard(amountPerPerson=3.5, unit="count"),
            "Dal": ServingStandard(amountPerPerson=0.1, unit="kg"),
        },
        safetyBuffer=0.1,  # 10%
    )
    res = prediction_service.recommend_quantities(req)
    req_map = {r.ingredient: r for r in res.requirements}

    # Rice: 100 * 0.15 * 1.1 = 16.5 kg
    assert req_map["Rice"].requiredQuantity == 16.5
    assert req_map["Rice"].status == "GROSS_REQUIREMENT"

    # Chapati: 100 * 3.5 * 1.1 = 385 -> integer rounded up
    assert req_map["Chapati"].requiredQuantity == 385.0
    assert req_map["Chapati"].unit == "count"


def test_qty_02_inventory_surplus_and_purchase():
    req = QuantityRecommendRequest(
        predictedAttendance=100,
        servingStandards={
            "Rice": ServingStandard(amountPerPerson=0.2, unit="kg"),
        },
        safetyBuffer=0.0,
        inventory={"Rice": 25.0},  # Required: 20kg, Inventory: 25kg -> 5kg surplus, 0 purchase
    )
    res = prediction_service.recommend_quantities(req)
    rice = res.requirements[0]
    assert rice.requiredQuantity == 20.0
    assert rice.purchaseQuantity == 0.0
    assert rice.surplusQuantity == 5.0
    assert rice.status == "PURCHASE_PLAN"


def test_wast_01_waste_percentage_and_prepared_zero():
    req = WasteAnalysisRequest(
        records=[
            WasteRecordInput(
                ingredient="Rice",
                preparedQuantity=50.0,
                consumedQuantity=40.0,
                leftoverQuantity=10.0,
                unit="kg",
            ),
            WasteRecordInput(
                ingredient="Paneer",
                preparedQuantity=0.0,
                consumedQuantity=0.0,
                leftoverQuantity=0.0,
                unit="kg",
            ),
        ]
    )
    res = prediction_service.analyze_waste(req)
    rice = next(s for s in res.summary if s.ingredient == "Rice")
    assert rice.wastePercentage == 20.0  # 10/50 * 100
    assert rice.consumptionRate == 80.0

    paneer = next(s for s in res.summary if s.ingredient == "Paneer")
    assert paneer.wastePercentage is None  # Never divide by zero


def test_wast_02_leftover_exceeding_prepared_flagged():
    req = WasteAnalysisRequest(
        records=[
            WasteRecordInput(
                ingredient="Dal",
                preparedQuantity=20.0,
                consumedQuantity=10.0,
                leftoverQuantity=30.0,  # Invalid
                unit="kg",
            )
        ]
    )
    res = prediction_service.analyze_waste(req)
    assert len(res.validationErrors) > 0

