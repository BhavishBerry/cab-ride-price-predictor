import os
import sys

import joblib
from xgboost import XGBRegressor

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from helper_functions.prep_data_function import CATEGORICAL_COLS, load_full_holdout, prepare_train_test

MODEL_DIR = "models"
DATA_PATH = "data/cab_rides_features.csv"
POOLED_TIERS = ["Shared", "UberPool"]
HOLDOUT_SAMPLE_SIZE = 500


def main():
    os.makedirs(MODEL_DIR, exist_ok=True)

    X_train, X_test, y_train, y_test = prepare_train_test(DATA_PATH)

    # Same is_pooled flag as notebook 02 — kept out of prepare_train_test so
    # the diff against notebook 01 stays visible there, added here instead.
    X_train["is_pooled"] = X_train["name"].isin(POOLED_TIERS)
    X_test["is_pooled"] = X_test["name"].isin(POOLED_TIERS)

    val_cut = int(len(X_train) * 0.8)
    X_tr, X_val = X_train.iloc[:val_cut], X_train.iloc[val_cut:]
    y_tr, y_val = y_train.iloc[:val_cut], y_train.iloc[val_cut:]

    model = XGBRegressor(
        max_depth=6,
        learning_rate=0.1,
        n_estimators=1000,
        enable_categorical=True,
        tree_method="hist",
        random_state=42,
        early_stopping_rounds=20,
        eval_metric="rmse",
    )
    model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)

    test_r2 = model.score(X_test, y_test)
    print(f"Trained model, best_iteration={model.best_iteration}, test R^2 = {test_r2:.4f}")

    # XGBoost's categorical splits are encoded using the category codes seen
    # at fit time. We persist the exact category levels from X_train so the
    # API can reapply the same encoding to single rows at inference time.
    category_levels = {col: list(X_train[col].cat.categories) for col in CATEGORICAL_COLS}

    # Native booster format avoids needing scikit-learn/scipy just to unpickle
    # the sklearn wrapper at serve time — keeps the deployed bundle small.
    model.get_booster().save_model(os.path.join(MODEL_DIR, "xgb_model.json"))
    joblib.dump(category_levels, os.path.join(MODEL_DIR, "category_levels.joblib"))

    # A small fixed sample to serve from instead of the full 638k-row CSV
    # (which is gitignored and too large to ship in a deployed function).
    holdout = load_full_holdout(DATA_PATH)
    holdout_sample = holdout.sample(n=HOLDOUT_SAMPLE_SIZE, random_state=42)
    holdout_sample.to_csv(os.path.join(MODEL_DIR, "holdout_sample.csv"), index=False)

    print(f"Saved model artifacts to {MODEL_DIR}/")


if __name__ == "__main__":
    main()
