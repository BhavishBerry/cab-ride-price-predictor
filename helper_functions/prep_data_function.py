import pandas as pd

CATEGORICAL_COLS = ["cab_type", "name", "source", "destination", "time_of_day", "demand_density"]
FEATURE_COLS = CATEGORICAL_COLS + [
      "distance", "rides_in_hour_at_source", "bad_weather_score",
      "is_raining", "is_weekend", "ride_hour", "uber_lyft_price_ratio",
  ]
TARGET_COL = "effective_surge"

def prepare_train_test(csv_path:str,test_size=0.2):
    df = pd.read_csv(csv_path,parse_dates=["ride_time"])
    df = df.sort_values("ride_time")

    for col in CATEGORICAL_COLS:
        df[col] = df[col].astype("category")

    split_point = df["ride_time"].quantile(1 - test_size)
    train = df[df["ride_time"] <= split_point]
    test = df[df["ride_time"] > split_point]

    X_train, y_train = train[FEATURE_COLS], train[TARGET_COL]
    X_test, y_test = test[FEATURE_COLS], test[TARGET_COL]

    return X_train,X_test,y_train,y_test
