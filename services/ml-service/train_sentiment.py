import csv
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

from preprocessing.text_preprocessor import TextPreprocessor

CURRENT_DIR = Path(__file__).resolve().parent
DATASET_PATH = CURRENT_DIR / "datasets" / "sentiment_data_synthetic.csv"
ARTIFACTS_DIR = CURRENT_DIR / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def train():
    print("[TRAIN] Starting sentiment analysis model training...")
    print(f"[TRAIN] Loading dataset from: {DATASET_PATH}")

    texts = []
    labels = []
    hasher = hashlib.sha256()

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            text = row["text"].strip()
            label = row["label"].strip()
            if text and label:
                processed, _ = TextPreprocessor.preprocess(text)
                texts.append(processed)
                labels.append(label)
                hasher.update(text.encode("utf-8"))

    data_hash = hasher.hexdigest()
    print(f"[TRAIN] Total samples loaded: {len(texts)} (SHA256: {data_hash[:12]})")

    # Split: 80% train, 20% test (stratified, fixed seed for determinism)
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels
    )

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=1500)
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    # Train LogisticRegression with probability support
    model = LogisticRegression(random_state=42, max_iter=500, C=1.5)
    model.fit(X_train_vec, y_train)

    y_pred = model.predict(X_test_vec)
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted")

    print(f"[TRAIN] Test Accuracy: {acc:.4f}")
    print(f"[TRAIN] Test F1 (weighted): {f1:.4f}")

    # Save artifacts
    model_path = ARTIFACTS_DIR / "sentiment_model.joblib"
    vectorizer_path = ARTIFACTS_DIR / "sentiment_vectorizer.joblib"
    metadata_path = ARTIFACTS_DIR / "sentiment_metadata.json"

    joblib.dump(model, model_path)
    joblib.dump(vectorizer, vectorizer_path)

    metadata = {
        "modelVersion": "sentiment-v1.0",
        "trainedOn": datetime.now(timezone.utc).isoformat(),
        "dataSource": "synthetic",
        "dataHash": data_hash,
        "sampleCount": len(texts),
        "testAccuracy": round(float(acc), 4),
        "testF1": round(float(f1), 4),
        "classes": list(model.classes_),
    }

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[TRAIN] Saved model to {model_path}")
    print(f"[TRAIN] Saved vectorizer to {vectorizer_path}")
    print(f"[TRAIN] Saved metadata to {metadata_path}")
    print("[TRAIN] Done.")


if __name__ == "__main__":
    train()

