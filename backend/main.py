import os
import sys

import joblib
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from helper_functions.prep_data_function import CATEGORICAL_COLS, FEATURE_COLS

DATA_PATH = "data/cab_rides_features.csv"
MODEL_PATH = "models/xgb_model.joblib"
CATEGORY_LEVELS_PATH = "models/category_levels.joblib"
POOLED_TIERS = ["Shared", "UberPool"]
TEST_SIZE = 0.2

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

    model = joblib.load(MODEL_PATH)
    category_levels = joblib.load(CATEGORY_LEVELS_PATH)

    df = pd.read_csv(DATA_PATH, parse_dates=["ride_time"])
    df = df.sort_values("ride_time")

    # Same time-based split prepare_train_test uses, but we keep every raw
    # column (price, source, destination, ...) for display in the API response.
    split_point = df["ride_time"].quantile(1 - TEST_SIZE)
    df = df[df["ride_time"] > split_point].reset_index(drop=True)

    for col in CATEGORICAL_COLS:
        df[col] = pd.Categorical(df[col], categories=category_levels[col])

    df["is_pooled"] = df["name"].isin(POOLED_TIERS)

    holdout_df = df


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/next-ride")
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

    predicted_surge = float(model.predict(X)[0])
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
