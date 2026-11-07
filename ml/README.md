# ML risk scoring

Random Forest fraud scorer used as a **risk signal** inside TRUSTLAYER.

It scores; it does not decide. Payment blocks come from the deterministic
rules engine (R1-R12). A high score adds an ESCALATE reason code.

## Files
- `predict.py` - `predict_fraud(transaction)` -> `{prediction, fraud_probability, threshold}`
- `rf_model.pkl` - trained RandomForest (50 trees, depth 12)
- `feature_columns.pkl` - one-hot column order used at training time

## Run
```bash
pip install -r requirements.txt
python predict.py
```

## Training data
Model was trained on the PaySim synthetic financial dataset (~6.3M rows,
`isFraud` label). The CSV is **not** committed - it is 470MB and GitHub
rejects files over 100MB.

Download: https://www.kaggle.com/datasets/ealaxi/paysim1
Place as `ml/trust_risk_engine.csv` to retrain (see notebook in git history
or reproduce with the same preprocessing: drop nameOrig/nameDest/isFlaggedFraud,
one-hot `type`, threshold 0.4).

## Input features
`step`, `amount`, `oldbalanceOrg`, `newbalanceOrig`, `oldbalanceDest`,
`newbalanceDest`, `type` (CASH_OUT | DEBIT | PAYMENT | TRANSFER).

## Caveats
- PaySim is synthetic mobile-money data, not PayPal data. Scores are a rough
  fraud prior, not proof.
- Tree models ignore feature scale, so the missing StandardScaler from the
  original notebook does not change predictions.
