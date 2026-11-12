import csv
import json
from datetime import datetime
from pathlib import Path
import joblib
import numpy as np
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

CURRENT_DIR = Path(__file__).resolve().parent
DATASET_PATH = CURRENT_DIR / "datasets" / "attendance_data_synthetic.csv"
ARTIFACTS_DIR = CURRENT_DIR / "artifacts"
EVAL_DIR = CURRENT_DIR / "evaluation"
EVAL_DIR.mkdir(parents=True, exist_ok=True)

MEAL_MAP = {"BREAKFAST": 0, "LUNCH": 1, "DINNER": 2, "SNACKS": 3}


def evaluate():
    print("=" * 60)
    print("MESSINSIGHT ATTENDANCE PREDICTION EVALUATION REPORT")
    print("DATA SOURCE: synthetic (explicitly marked, university prototype)")
    print("=" * 60)

    model_path = ARTIFACTS_DIR / "attendance_model.joblib"
    if not model_path.exists():
        print("[ERROR] Attendance model not found. Run train_attendance.py first.")
        return

    model = joblib.load(model_path)

    rows = []
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            dt = datetime.strptime(r["serviceDate"], "%Y-%m-%d").date()
            rows.append({
                "date": dt,
                "meal": r["mealType"],
                "attendance": float(r["attendance"]),
            })

    rows.sort(key=lambda x: (x["date"], MEAL_MAP.get(x["meal"], 0)))

    X = np.array([[r["date"].weekday(), MEAL_MAP.get(r["meal"], 0)] for r in rows])
    y = np.array([r["attendance"] for r in rows])

    # Chronological evaluation on 20% holdout test set
    split_idx = int(len(X) * 0.8)
    X_test, y_test = X[split_idx:], y[split_idx:]

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = root_mean_squared_error(y_test, y_pred)

    baseline_val = np.mean(y[:split_idx])
    baseline_mae = mean_absolute_error(y_test, [baseline_val] * len(y_test))

    print(f"Test Samples: {len(X_test)}")
    print(f"Random Forest MAE:  {mae:.2f}")
    print(f"Random Forest RMSE: {rmse:.2f}")
    print(f"Baseline Mean MAE:  {baseline_mae:.2f}")
    print(f"MAE Improvement:    {((baseline_mae - mae) / baseline_mae) * 100:.1f}%")

    out_file = EVAL_DIR / "attendance_evaluation.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "dataSource": "synthetic",
                "testSamples": len(X_test),
                "mae": round(float(mae), 2),
                "rmse": round(float(rmse), 2),
                "baselineMAE": round(float(baseline_mae), 2),
            },
            f,
            indent=2,
        )

    print(f"Saved evaluation metrics to: {out_file}")


if __name__ == "__main__":
    evaluate()

