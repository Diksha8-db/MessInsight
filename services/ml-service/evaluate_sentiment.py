import csv
import json
from pathlib import Path
import joblib
from sklearn.metrics import classification_report, confusion_matrix

from preprocessing.text_preprocessor import TextPreprocessor

CURRENT_DIR = Path(__file__).resolve().parent
DATASET_PATH = CURRENT_DIR / "datasets" / "sentiment_data_synthetic.csv"
ARTIFACTS_DIR = CURRENT_DIR / "artifacts"
EVAL_DIR = CURRENT_DIR / "evaluation"
EVAL_DIR.mkdir(parents=True, exist_ok=True)


def evaluate():
    print("=" * 60)
    print("MESSINSIGHT NLP SENTIMENT EVALUATION REPORT")
    print("DATA SOURCE: synthetic (explicitly marked, university project prototype)")
    print("=" * 60)

    model_path = ARTIFACTS_DIR / "sentiment_model.joblib"
    vectorizer_path = ARTIFACTS_DIR / "sentiment_vectorizer.joblib"

    if not model_path.exists() or not vectorizer_path.exists():
        print("[ERROR] Model artifacts not found. Please run train_sentiment.py first.")
        return

    model = joblib.load(model_path)
    vectorizer = joblib.load(vectorizer_path)

    texts = []
    labels = []
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            text = row["text"].strip()
            label = row["label"].strip()
            if text and label:
                processed, _ = TextPreprocessor.preprocess(text)
                texts.append(processed)
                labels.append(label)

    X_vec = vectorizer.transform(texts)
    y_pred = model.predict(X_vec)

    report = classification_report(labels, y_pred, output_dict=True)
    matrix = confusion_matrix(labels, y_pred, labels=list(model.classes_))

    print("\nClassification Report:")
    print(classification_report(labels, y_pred))

    print("Confusion Matrix:")
    print("Classes:", list(model.classes_))
    print(matrix)

    out_file = EVAL_DIR / "confusion_matrix.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(
            {
                "dataSource": "synthetic",
                "classes": list(model.classes_),
                "confusionMatrix": matrix.tolist(),
                "metrics": report,
            },
            f,
            indent=2,
        )

    print(f"\nSaved evaluation metrics and confusion matrix to: {out_file}")


if __name__ == "__main__":
    evaluate()

