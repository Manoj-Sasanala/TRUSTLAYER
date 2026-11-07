"""Fraud risk scoring for TRUSTLAYER.

Random Forest trained on PaySim features (step, amount, balances, type).
Returns a risk score only - it never blocks a payment on its own.
BLOCK decisions come from the deterministic rules engine (R1-R12).
"""

import joblib
import pandas as pd
from pathlib import Path

MODEL_DIR = Path(__file__).parent
rf = joblib.load(MODEL_DIR / "rf_model.pkl")
feature_columns = joblib.load(MODEL_DIR / "feature_columns.pkl")

# Risk score is a signal, not a verdict. Borderline scores escalate to a human.
THRESHOLD = 0.4

REQUIRED_FEATURES = [
    "step",
    "amount",
    "oldbalanceOrg",
    "newbalanceOrig",
    "oldbalanceDest",
    "newbalanceDest",
    "type",
]

VALID_TYPES = ["CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"]


def validate_transaction(transaction):
    for feature in REQUIRED_FEATURES:
        if feature not in transaction:
            raise ValueError(f"Missing feature: {feature}")

    if transaction["type"] not in VALID_TYPES:
        raise ValueError("Invalid transaction type")

    for feature in REQUIRED_FEATURES[:-1]:
        if transaction[feature] < 0:
            raise ValueError(f"{feature} cannot be negative")

    return True


def predict_fraud(transaction):
    validate_transaction(transaction)
    input_df = pd.DataFrame([transaction])
    input_df = pd.get_dummies(input_df, columns=["type"])
    input_df = input_df.reindex(columns=feature_columns, fill_value=0)
    probability = rf.predict_proba(input_df)[0][1]

    return {
        "prediction": "Fraud" if probability >= THRESHOLD else "Legitimate",
        "fraud_probability": round(float(probability), 4),
        "threshold": THRESHOLD,
    }


if __name__ == "__main__":
    sample = {
        "step": 100,
        "amount": 50000,
        "oldbalanceOrg": 50000,
        "newbalanceOrig": 0,
        "oldbalanceDest": 10000,
        "newbalanceDest": 60000,
        "type": "TRANSFER",
    }
    print(predict_fraud(sample))
