"""Fraud and transaction risk scoring for TRUSTLAYER.

Owner: Tejas. Branch: rules/engine.

Trained on realistic $1-$500 purchase intents.
Provides an explainable risk signal only.
Payment blocks come strictly from the deterministic rules engine (R1-R12).
"""

from decimal import Decimal
from pathlib import Path
from typing import Any

import joblib
import numpy as np

MODEL_DIR = Path(__file__).resolve().parent

try:
    rf = joblib.load(MODEL_DIR / "rf_model.pkl")
    feature_columns = joblib.load(MODEL_DIR / "feature_columns.pkl")
except Exception:
    rf = None
    feature_columns = None


def _to_float(val: Any, name: str) -> float:
    if isinstance(val, (int, float)):
        num = float(val)
    elif isinstance(val, Decimal):
        num = float(val)
    elif isinstance(val, str):
        try:
            num = float(val.strip().replace("$", ""))
        except ValueError:
            raise ValueError(f"Invalid numeric string for {name}: {val!r}")
    else:
        raise ValueError(f"Invalid type for {name}: {type(val).__name__}")

    if np.isnan(num) or np.isinf(num):
        raise ValueError(f"{name} must be a finite number.")
    return num


def score_intent(
    amount: Any,
    txn_count_1h: Any,
    mandate_limit: Any,
    merchant_is_new: Any,
    hour_of_day: Any,
) -> dict[str, Any]:
    """Score a purchase intent based on transaction and mandate context.

    Returns:
    {
        "risk": 0.12,
        "band": "LOW",
        "reasons": []
    }
    """
    amt = _to_float(amount, "amount")
    if amt <= 0:
        raise ValueError(f"amount must be positive, got {amt}")

    limit = _to_float(mandate_limit, "mandate_limit")
    if limit <= 0:
        raise ValueError(f"mandate_limit must be positive, got {limit}")

    try:
        count = int(txn_count_1h)
    except (ValueError, TypeError):
        raise ValueError(f"txn_count_1h must be an integer, got {txn_count_1h!r}")
    if count < 0:
        raise ValueError(f"txn_count_1h cannot be negative, got {count}")

    is_new = bool(merchant_is_new)

    try:
        hour = int(hour_of_day)
    except (ValueError, TypeError):
        raise ValueError(f"hour_of_day must be an integer, got {hour_of_day!r}")
    if not (0 <= hour <= 23):
        raise ValueError(f"hour_of_day must be between 0 and 23, got {hour}")

    ratio = amt / limit

    # Explainable reasons
    reasons: list[str] = []
    if ratio > 0.8:
        reasons.append("High transaction amount relative to mandate limit")
    elif amt >= 150.0:
        reasons.append("Elevated transaction amount")

    if is_new:
        reasons.append("First-time merchant interaction")

    if count >= 4:
        reasons.append(f"High velocity: {count} transactions in the past hour")

    if hour in (1, 2, 3, 4):
        reasons.append(f"Off-hours activity ({hour:02d}:00 UTC)")

    # ML Inference
    if rf is not None:
        X = np.array([[amt, limit, ratio, count, int(is_new), hour]], dtype=float)
        prob = float(rf.predict_proba(X)[0][1])
    else:
        # Fallback heuristic calculation if model file is not present
        prob = 0.05
        if ratio > 0.8:
            prob += 0.35
        if is_new:
            prob += 0.20
        if count >= 4:
            prob += 0.25
        if hour in (1, 2, 3, 4):
            prob += 0.15
        prob = min(prob, 0.99)

    risk = round(float(prob), 2)

    # Risk bands
    if risk >= 0.60:
        band = "HIGH"
    elif risk >= 0.30:
        band = "MEDIUM"
    else:
        band = "LOW"

    return {
        "risk": risk,
        "band": band,
        "reasons": reasons,
    }


def predict_fraud(transaction: dict[str, Any]) -> dict[str, Any]:
    """Backward compatibility wrapper."""
    amount = transaction.get("amount", 25.0)
    mandate_limit = transaction.get("mandate_limit", 100.0)
    txn_count = transaction.get("txn_count_1h", 0)
    merchant_is_new = transaction.get("merchant_is_new", False)
    hour = transaction.get("step", 12) % 24

    result = score_intent(amount, txn_count, mandate_limit, merchant_is_new, hour)
    return {
        "prediction": "Fraud" if result["band"] == "HIGH" else "Legitimate",
        "fraud_probability": result["risk"],
        "threshold": 0.4,
        "band": result["band"],
        "reasons": result["reasons"],
    }
