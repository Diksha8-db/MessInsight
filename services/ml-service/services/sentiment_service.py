import json
import os
import re
from pathlib import Path
from typing import List, Optional, Tuple
import joblib
from rapidfuzz import fuzz

from preprocessing.text_preprocessor import TextPreprocessor
from schemas.nlp_schemas import (
    DishMention,
    IssueMention,
    IssueType,
    SentimentDetail,
    SentimentLabel,
)

ARTIFACTS_DIR = Path(__file__).resolve().parent.parent / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "sentiment_model.joblib"
VECTORIZER_PATH = ARTIFACTS_DIR / "sentiment_vectorizer.joblib"
METADATA_PATH = ARTIFACTS_DIR / "sentiment_metadata.json"

# Lexicon baseline keywords
POSITIVE_WORDS = {
    "delicious", "good", "great", "excellent", "tasty", "love", "loved", "fresh",
    "awesome", "best", "perfect", "warm", "tender", "nice", "enjoyed", "healthy",
}

NEGATIVE_WORDS = {
    "terrible", "bad", "awful", "horrible", "stale", "cold", "dirty", "undercooked",
    "overcooked", "salty", "spicy", "tasteless", "bland", "worst", "unhygienic",
    "insects", "hair", "hairball", "raw", "burnt", "smelly", "rotten",
}

ISSUE_KEYWORDS = {
    IssueType.TOO_SALTY: ["too salty", "excess salt", "over salted", "salty"],
    IssueType.TOO_SPICY: ["too spicy", "excess spice", "burning", "spicy", "mirchi"],
    IssueType.COLD_FOOD: ["cold", "chilled", "not hot", "cold food", "not warm"],
    IssueType.UNDERCOOKED: ["undercooked", "raw", "unboiled", "hard rice", "half cooked"],
    IssueType.OVERCOOKED: ["overcooked", "burnt", "mushy", "blackened"],
    IssueType.LESS_QUANTITY: ["less quantity", "small portion", "not enough", "ran out", "shortage"],
    IssueType.BAD_TASTE: ["bad taste", "tasteless", "bland", "awful taste", "terrible flavor", "no taste"],
    IssueType.POOR_HYGIENE: ["dirty", "hair in food", "unhygienic", "flies", "dirty plate", "cockroach"],
    IssueType.CONTAMINATION: ["stone", "pebble", "plastic", "insect", "worm", "contamination"],
    IssueType.POOR_TEXTURE: ["rubbery", "watery", "too thick", "lumpy", "stiff"],
}


class SentimentService:
    def __init__(self):
        self.model = None
        self.vectorizer = None
        self.metadata = {}
        self.is_loaded = False
        self.load_model()

    def load_model(self) -> bool:
        try:
            if MODEL_PATH.exists() and VECTORIZER_PATH.exists():
                self.model = joblib.load(MODEL_PATH)
                self.vectorizer = joblib.load(VECTORIZER_PATH)
                if METADATA_PATH.exists():
                    with open(METADATA_PATH, "r", encoding="utf-8") as f:
                        self.metadata = json.load(f)
                self.is_loaded = True
                return True
        except Exception:
            pass
        self.is_loaded = False
        return False

    def rule_based_sentiment(self, text: str) -> SentimentDetail:
        lower = text.lower()
        words = set(re.findall(r"\b\w+\b", lower))

        pos_count = sum(1 for w in words if w in POSITIVE_WORDS)
        neg_count = sum(1 for w in words if w in NEGATIVE_WORDS)

        if pos_count > 0 and neg_count > 0:
            return SentimentDetail(label=SentimentLabel.MIXED, score=0.0, confidence=0.7)
        if pos_count > neg_count:
            score = min(1.0, 0.4 + 0.2 * pos_count)
            return SentimentDetail(label=SentimentLabel.POSITIVE, score=score, confidence=0.75)
        if neg_count > pos_count:
            score = max(-1.0, -0.4 - 0.2 * neg_count)
            return SentimentDetail(label=SentimentLabel.NEGATIVE, score=score, confidence=0.75)

        return SentimentDetail(label=SentimentLabel.NEUTRAL, score=0.0, confidence=0.5)

    def extract_dishes(self, text: str, menu_dishes: List[str]) -> List[DishMention]:
        if not menu_dishes:
            return []

        matched: List[DishMention] = []
        lower_text = text.lower()

        for dish in menu_dishes:
            dish_lower = dish.lower().strip()
            # 1. Exact substring match
            pattern = re.escape(dish_lower)
            for m in re.finditer(pattern, lower_text):
                matched.append(
                    DishMention(
                        dish=dish,
                        start=m.start(),
                        end=m.end(),
                        matchScore=100.0,
                    )
                )

            # 2. Fuzzy match word-by-word if no exact match
            if not any(dm.dish == dish for dm in matched):
                score = fuzz.partial_ratio(dish_lower, lower_text)
                if score >= 85:
                    matched.append(
                        DishMention(
                            dish=dish,
                            start=0,
                            end=len(text),
                            matchScore=float(score),
                        )
                    )

        return matched

    def extract_issues(self, text: str, matched_dishes: List[DishMention]) -> List[IssueMention]:
        issues: List[IssueMention] = []
        lower = text.lower()

        for issue_type, keywords in ISSUE_KEYWORDS.items():
            for kw in keywords:
                idx = lower.find(kw)
                if idx != -1:
                    # Find nearest dish mentioned
                    nearest_dish = None
                    min_dist = float("inf")
                    for d in matched_dishes:
                        dist = abs(d.start - idx)
                        if dist < min_dist:
                            min_dist = dist
                            nearest_dish = d.dish

                    issues.append(IssueMention(type=issue_type, dish=nearest_dish))
                    break  # Matched this issue type, avoid duplicate same issue

        return issues

    def analyze(
        self,
        text: str,
        menu_dishes: List[str] = [],
        language: Optional[str] = None,
    ) -> Tuple[SentimentDetail, List[DishMention], List[IssueMention], str, str]:
        # Clean and preprocess
        cleaned, detected_lang = TextPreprocessor.preprocess(text)
        lang = language or detected_lang

        # Edge cases: empty / very short or uninformative text
        meaningful_words = [w for w in re.findall(r"\b\w+\b", cleaned) if len(w) > 1]
        if len(meaningful_words) < 2 or re.fullmatch(r"^[.\s!?]+$", text) or text.lower().strip() in {"ok", "fine", "hmm"}:
            sentiment = SentimentDetail(label=SentimentLabel.UNCERTAIN, score=0.0, confidence=0.2)
            dishes = self.extract_dishes(text, menu_dishes)
            return sentiment, dishes, [], lang, "rule-baseline-v1"

        # Model inference if loaded
        if self.is_loaded and self.model and self.vectorizer:
            try:
                features = self.vectorizer.transform([cleaned])
                pred_label = self.model.predict(features)[0]

                # Probabilities if supported
                if hasattr(self.model, "predict_proba"):
                    probs = self.model.predict_proba(features)[0]
                    confidence = float(max(probs))
                else:
                    confidence = 0.82

                label_enum = SentimentLabel(pred_label)
                score_map = {
                    SentimentLabel.POSITIVE: 0.8,
                    SentimentLabel.NEUTRAL: 0.0,
                    SentimentLabel.NEGATIVE: -0.8,
                    SentimentLabel.MIXED: 0.0,
                    SentimentLabel.UNCERTAIN: 0.0,
                }
                sentiment = SentimentDetail(
                    label=label_enum,
                    score=score_map.get(label_enum, 0.0),
                    confidence=confidence,
                )
                model_ver = self.metadata.get("modelVersion", "sentiment-v1.0")
            except Exception:
                sentiment = self.rule_based_sentiment(cleaned)
                model_ver = "rule-fallback-v1"
        else:
            sentiment = self.rule_based_sentiment(cleaned)
            model_ver = "rule-baseline-v1"

        # Extract dishes & issues
        dishes = self.extract_dishes(text, menu_dishes)
        issues = self.extract_issues(text, dishes)

        # If issues found on specific dish and positive on another -> label as MIXED
        if len(issues) > 0 and sentiment.label == SentimentLabel.POSITIVE:
            sentiment.label = SentimentLabel.MIXED
            sentiment.score = 0.0

        return sentiment, dishes, issues, lang, model_ver


sentiment_service = SentimentService()

