import csv
import json
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

CURRENT_DIR = Path(__file__).resolve().parent
DATASET_PATH = CURRENT_DIR / "datasets" / "attendance_data_synthetic.csv"
ARTIFACTS_DIR = CURRENT_DIR / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

MEAL_MAP = {"BREAKFAST": 0, "LUNCH": 1, "DINNER": 2, "SNACKS": 3}


def train():
    print("[TRAIN] Starting attendance prediction model training...")
    rows = []

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            dt = datetime.strptime(r["serviceDate"], "%Y-%m-%d").date()
            rows.append({
                "date": dt,
                "meal": r["mealType"],
                "attendance": float(r["attendance"]),
                "capacity": float(r["capacity"]),
            })

    # Sort strictly chronologically
    rows.sort(key=lambda x: (x["date"], MEAL_MAP.get(x["meal"], 0)))

    X = []
    y = []
    for r in rows:
        weekday = r["date"].weekday()
        meal_idx = MEAL_MAP.get(r["meal"], 0)
        # Feature vector: [weekday (0-6), meal (0-3)]
        X.append([weekday, meal_idx])
        y.append(r["attendance"])

    X = np.array(X)
    y = np.array(y)

    # Chronological split: 80% train, 20% test (no future data leakage)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    # Baseline: historical meal mean
    baseline_pred = np.mean(y_train)
    baseline_mae = mean_absolute_error(y_test, [baseline_pred] * len(y_test))

    # Model: Random Forest
    rf = RandomForestRegressor(n_estimators=50, random_state=42)
    rf.fit(X_train, y_train)

    rf_pred = rf.predict(X_test)
    rf_mae = mean_absolute_error(y_test, rf_pred)
    rf_rmse = root_mean_squared_error(y_test, rf_pred)

    print(f"[TRAIN] Total samples: {len(X)} (Train: {len(X_train)}, Test: {len(X_test)})")
    print(f"[TRAIN] Baseline MAE: {baseline_mae:.2f}")
    print(f"[TRAIN] Random Forest Test MAE: {rf_mae:.2f}, RMSE: {rf_rmse:.2f}")

    model_path = ARTIFACTS_DIR / "attendance_model.joblib"
    joblib.dump(rf, model_path)

    metadata = {
        "modelVersion": "attendance-v1.0",
        "trainedOn": datetime.now(timezone.utc).isoformat(),
        "dataSource": "synthetic",
        "sampleCount": len(X),
        "testMAE": round(float(rf_mae), 2),
        "testRMSE": round(float(rf_rmse), 2),
        "baselineMAE": round(float(baseline_mae), 2),
    }

    metadata_path = ARTIFACTS_DIR / "attendance_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[TRAIN] Saved model to {model_path}")
    print(f"[TRAIN] Saved metadata to {metadata_path}")


if __name__ == "__main__":
    train()

