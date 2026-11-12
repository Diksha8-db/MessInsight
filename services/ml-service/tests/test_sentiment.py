import pytest
from services.sentiment_service import sentiment_service
from preprocessing.text_preprocessor import TextPreprocessor
from schemas.nlp_schemas import SentimentLabel, IssueType


def test_nlp_01_positive_sentiment():
    text = "The food was delicious and fresh"
    sentiment, dishes, issues, lang, _ = sentiment_service.analyze(text)
    assert sentiment.label == SentimentLabel.POSITIVE
    assert sentiment.score > 0


def test_nlp_02_negative_sentiment_and_issue():
    text = "The dal was too salty and inedible"
    sentiment, dishes, issues, lang, _ = sentiment_service.analyze(text, menu_dishes=["Dal Tadka", "Rice"])
    assert sentiment.label == SentimentLabel.NEGATIVE
    assert any(iss.type == IssueType.TOO_SALTY for iss in issues)


def test_nlp_03_mixed_sentiment_and_multiple_dishes():
    text = "Rice was good but vegetables were cold"
    sentiment, dishes, issues, lang, _ = sentiment_service.analyze(
        text, menu_dishes=["Rice", "Mix Vegetable"]
    )
    # Vegetables cold should trigger COLD_FOOD issue
    assert any(iss.type == IssueType.COLD_FOOD for iss in issues)
    assert sentiment.label in [SentimentLabel.MIXED, SentimentLabel.NEGATIVE]


def test_nlp_04_uncertain_for_short_or_meaningless_text():
    for short_text in ["ok", "....", "fine", "!!"]:
        sentiment, _, _, _, _ = sentiment_service.analyze(short_text)
        assert sentiment.label == SentimentLabel.UNCERTAIN
        assert sentiment.confidence <= 0.4


def test_nlp_05_hindi_english_food_terms():
    text = "Khana bahut bakwas tha aur thanda mila"
    sentiment, dishes, issues, lang, _ = sentiment_service.analyze(text)
    assert lang == "hi-en"
    assert sentiment.label == SentimentLabel.NEGATIVE


def test_nlp_06_negation_handling():
    text = "The curry was not good at all"
    sentiment, _, _, _, _ = sentiment_service.analyze(text)
    assert sentiment.label == SentimentLabel.NEGATIVE


def test_nlp_07_dish_extraction_fuzzy_match():
    text = "Paneer butter was excellent"
    sentiment, dishes, issues, lang, _ = sentiment_service.analyze(
        text, menu_dishes=["Paneer Butter Masala", "Jeera Rice"]
    )
    assert len(dishes) > 0
    assert dishes[0].dish == "Paneer Butter Masala"


def test_nlp_08_preprocessing_pipeline():
    cleaned, lang = TextPreprocessor.preprocess("Daal was 👍 and chawal was accha")
    assert "dal" in cleaned
    assert "rice" in cleaned
    assert "good" in cleaned
    assert lang == "hi-en"

