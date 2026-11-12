import re
from typing import Tuple

HINDI_ENGLISH_MAP = {
    r"\bkhana\b": "food",
    r"\bnamkeen\b": "salty",
    r"\bbakwas\b": "terrible",
    r"\bthanda\b": "cold",
    r"\bgarm\b": "hot",
    r"\bkam\b": "less",
    r"\bjyada\b": "more",
    r"\bzyada\b": "more",
    r"\baccha\b": "good",
    r"\bacha\b": "good",
    r"\bachha\b": "good",
    r"\bbekhar\b": "bad",
    r"\bbekar\b": "bad",
    r"\bganda\b": "dirty",
    r"\bbura\b": "bad",
    r"\bswadisht\b": "delicious",
    r"\bmasaledar\b": "spicy",
    r"\bteekha\b": "spicy",
    r"\bkacha\b": "undercooked",
    r"\bkaccha\b": "undercooked",
    r"\bbaasi\b": "stale",
    r"\bmitha\b": "sweet",
    r"\bmeetha\b": "sweet",
}

SPELLING_VARIANTS = {
    r"\bdaal\b": "dal",
    r"\bdhal\b": "dal",
    r"\bchawl\b": "rice",
    r"\bchawal\b": "rice",
    r"\bpanir\b": "paneer",
    r"\bsabji\b": "vegetables",
    r"\bsabzi\b": "vegetables",
    r"\broti\b": "chapati",
    r"\bchapatti\b": "chapati",
    r"\bchappati\b": "chapati",
}

EMOJI_MAP = {
    "👍": " good ",
    "😋": " delicious ",
    "😍": " great ",
    "👌": " perfect ",
    "👎": " bad ",
    "🤢": " disgusting ",
    "🤮": " terrible ",
    "😡": " angry ",
    "😭": " terrible ",
    "❤️": " love ",
}

NEGATION_PATTERNS = [
    (r"\bnot\s+good\b", "bad"),
    (r"\bnot\s+tasty\b", "bad"),
    (r"\bnot\s+fresh\b", "stale"),
    (r"\bnot\s+clean\b", "dirty"),
    (r"\bnot\s+bad\b", "acceptable"),
    (r"\bnot\s+too\s+salty\b", "mild_salt"),
    (r"\bnot\s+too\s+spicy\b", "mild_spice"),
    (r"\bnot\s+cold\b", "warm"),
    (r"\bnot\s+enough\b", "less_quantity"),
]


class TextPreprocessor:
    @staticmethod
    def detect_language(text: str) -> str:
        # Check for Devanagari Unicode block
        if re.search(r"[\u0900-\u097F]", text):
            return "hi"
        # Check for Hindi-English loan words
        lower = text.lower()
        hindi_words = ["khana", "thanda", "accha", "bakwas", "jyada", "kam", "namkeen", "teekha", "sabzi", "roti", "dal", "chawal"]
        if any(re.search(r"\b" + w + r"\b", lower) for w in hindi_words):
            return "hi-en"
        return "en"

    @staticmethod
    def preprocess(text: str) -> Tuple[str, str]:
        if not text:
            return "", "en"

        lang = TextPreprocessor.detect_language(text)

        # 1. Replace emojis with semantic word tokens
        processed = text
        for emoji, token in EMOJI_MAP.items():
            processed = processed.replace(emoji, token)

        # 2. Lowercase and normalize whitespace
        processed = processed.lower().strip()

        # 3. Handle Hindi-English words
        for pattern, replacement in HINDI_ENGLISH_MAP.items():
            processed = re.sub(pattern, replacement, processed)

        # 4. Handle common spelling variants
        for pattern, replacement in SPELLING_VARIANTS.items():
            processed = re.sub(pattern, replacement, processed)

        # 5. Handle compound negations
        for pattern, replacement in NEGATION_PATTERNS:
            processed = re.sub(pattern, replacement, processed)

        # 6. Normalize punctuation and repeated characters
        processed = re.sub(r"([!?.])\1+", r"\1", processed)  # !!! -> !
        processed = re.sub(r"\s+", " ", processed).strip()

        return processed, lang

