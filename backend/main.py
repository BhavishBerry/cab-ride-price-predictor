import os
import sys

import joblib
import pandas as pd
import xgboost as xgb
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from helper_functions.prep_data_function import CATEGORICAL_COLS, FEATURE_COLS

HOLDOUT_PATH = "models/holdout_sample.csv"
MODEL_PATH = "models/xgb_model.json"
CATEGORY_LEVELS_PATH = "models/category_levels.joblib"
POOLED_TIERS = ["Shared", "UberPool"]

# Same is_pooled flag the served model was trained with (see scripts/train_model.py),
# appended after the categorical/numeric columns prepare_train_test already produces.
INFERENCE_COLS = FEATURE_COLS + ["is_pooled"]

app = FastAPI(title="Dynamic Pricing API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
holdout_df = None


@app.on_event("startup")
def load_artifacts():
    global model, holdout_df

    model = xgb.Booster()
    model.load_model(MODEL_PATH)
    category_levels = joblib.load(CATEGORY_LEVELS_PATH)

    df = pd.read_csv(HOLDOUT_PATH, parse_dates=["ride_time"])

    for col in CATEGORICAL_COLS:
        df[col] = pd.Categorical(df[col], categories=category_levels[col])

    df["is_pooled"] = df["name"].isin(POOLED_TIERS)

    holdout_df = df


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/next-ride")
def next_ride():
    row = holdout_df.sample(n=1).iloc[0]

    # Built from a dict rather than slicing the Series directly, since a
    # mixed-dtype row collapses to object dtype and loses the category
    # encoding (and numeric dtypes) XGBoost expects.
    X = pd.DataFrame({col: [row[col]] for col in INFERENCE_COLS})
    for col in CATEGORICAL_COLS:
        X[col] = pd.Categorical(X[col], categories=holdout_df[col].cat.categories)
    for col in INFERENCE_COLS:
        if col not in CATEGORICAL_COLS:
            X[col] = X[col].astype(holdout_df[col].dtype)

    dmat = xgb.DMatrix(X, enable_categorical=True)
    predicted_surge = float(model.predict(dmat)[0])
    predicted_price = row["base_price_per_mile"] * row["distance"] * predicted_surge

    return {
        "source": row["source"],
        "destination": row["destination"],
        "cab_type": row["cab_type"],
        "name": row["name"],
        "distance": float(row["distance"]),
        "ride_time": row["ride_time"].isoformat(),
        "predicted_surge": predicted_surge,
        "predicted_price": float(predicted_price),
        "actual_price": float(row["price"]),
    }
