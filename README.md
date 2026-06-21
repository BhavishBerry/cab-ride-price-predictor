# Dynamic Pricing Engine

A dynamic pricing system modeled on Uber/Lyft surge pricing: real ride data is used to learn how much a ride's price rises above its base rate under different conditions (demand, weather, time of day, service tier), served through a FastAPI backend, and shown live in an Expo Go mobile app.

Built as a 4-day summer training project (B.Tech AIML, PCTE Ludhiana).

## What this is

Given a ride's route, service tier, and conditions at the time, predict the **surge multiplier** — how much more it costs than the base, non-surged rate. The mobile app polls the API for simulated "live" rides pulled from a held-out slice of real historical data and shows the model's predicted price next to what was actually charged.

## Architecture

```
data/  ───────►  notebooks/  ───────►  scripts/train_model.py  ───────►  models/*.joblib
(raw CSVs)        (prep, features,          (trains + saves                  │
                   modeling, all                the final model)             │
                   experiments)                                              ▼
                                                                      backend/main.py
                                                                      (FastAPI, /next-ride)
                                                                              │
                                                                       HTTP, polled every 10s
                                                                              ▼
                                                                      mobile/ (Expo Go app)
                                                                      Live Rides feed + map
```

## Dataset

[`ravi72munde/uber-lyft-cab-prices`](https://www.kaggle.com/datasets/ravi72munde/uber-lyft-cab-prices) — a real scrape of the Uber and Lyft pricing APIs in Boston, Nov–Dec 2018: 693k rides across 12 pickup/dropoff zones and 12 service tiers, joined with hourly weather by neighborhood. Chosen over a synthetic alternative specifically so every modeling decision had to deal with the messiness of real data (missing values, a broken ground-truth column, no rider/driver counts) rather than a clean synthetic target.

## Methodology

### Data prep (`notebooks/data_preprocessing_and_feature_engineering.ipynb`)

- Dropped 55,095 rows where `price` was null — all belonged to the `Taxi` product, which never had price estimates captured in this scrape.
- Fixed a timestamp unit mismatch (`cab_rides` in milliseconds, `weather` in seconds) before joining.
- Weather is sampled roughly hourly per neighborhood while rides happen continuously, so the two were joined with `pd.merge_asof` (nearest-time match per location) rather than an exact join. Verified the match quality by checking the time gap between each ride and its matched weather reading (median ~10 min, max ~55 min).
- Missing `rain` values were filled with 0 — the weather source only logs a row when there's measurable rain, so missing means "no rain," not "unknown."

Output: `data/cab_rides_with_weather.csv` (637,976 rows × 20 columns).

### Feature engineering (`notebooks/feature_engineering.ipynb`)

- `price_per_mile` — normalizes price across different trip lengths.
- Time decomposition — `ride_hour`, `is_weekend`, `time_of_day` bucket.
- `demand_density` — the dataset has no rider/driver counts, so as a demand proxy this buckets (quartiles) how many rides were requested at the same pickup zone within the same hour.
- `uber_lyft_price_ratio` — same route, same hour, Uber's average price ÷ Lyft's, capturing competitive pricing pressure. Left as `NaN` (not imputed) for the ~3k route+hour windows where only one platform was operating — fabricating a competitor price that didn't exist would be more misleading than a missing value.
- `is_raining` and a normalized `bad_weather_score` (clouds + rain + wind, each scaled to 0–1).

Output: `data/cab_rides_features.csv` (637,976 rows × 29 columns).

### The surge-proxy problem

The dataset's `surge_multiplier` column is **only real for Lyft**. Uber's API never exposed its live multiplier — it's always `1.0` for every Uber ride, with the markup folded directly into the price instead. That column can't be used as a uniform prediction target across both platforms.

To work around this, `effective_surge` was built as a custom target: each ride's `price_per_mile` divided by a "floor" rate for its exact `(source, destination, service tier)` group — the 10th percentile of price-per-mile within that group, since fares only rise from the base rate, never fall below it. For Lyft, the floor is computed only from rides with `surge_multiplier == 1.0` (the genuinely non-surged ones); for Uber, which has no such flag, the floor uses all rides in the group. The result is clipped at 5.0 to remove division artifacts from very short (<0.1 mile) rides.

**Validation:** grouping Lyft rides by their *real* `surge_multiplier` and averaging `effective_surge` within each group shows the proxy tracking the ground truth closely (true 1.5 → proxy mean 1.62, true 2.0 → proxy mean 2.12, true 3.0 → proxy mean 3.01) — accurate enough to trust as the prediction target for both platforms.

### Modeling — four notebooks, in order

| Notebook | Approach | Test R² | Outcome |
|---|---|---|---|
| `base_deterministic_model.ipynb` | Rule-based: median `effective_surge` per `demand_density` bucket | **-0.09** | Worse than guessing the mean — the four buckets' medians barely differ (1.118–1.120), so `demand_density` alone carries almost no signal |
| `00_base_model.ipynb` | XGBoost, default hyperparameters | 0.5615 | Clear improvement over the rule-based baseline |
| `01_xgboost_tuned.ipynb` | `GridSearchCV` over `max_depth`/`learning_rate` with `TimeSeriesSplit`, `n_estimators` picked via early stopping | 0.5618 | **Dead end** — tuning moved R² by 0.0003, not a meaningful gain |
| `02_xgboost_pooled_feature.ipynb` | Added an explicit `is_pooled` flag for `Shared`/`UberPool` tiers, the segment with ~2x the error of every other tier | 0.5616 | **Also a dead end** — the model already had this information via the `name` category; the real issue is pooled rides depend on co-rider count, which isn't in the data at all |

Both "dead end" notebooks are included deliberately — they're documented experiments with a clear hypothesis and an honest negative result, not failed attempts that were deleted.

**Per-ride error, final model:** median absolute error ≈6% of the true multiplier, but a real tail — the 99th percentile is off by ≈49%, driven almost entirely by the unmodelable pooled-ride segment.

**Train/test split is always time-based** (sorted by `ride_time`, last 20% held out), never random — a random split would leak future demand patterns into training.

The model trained in `02_xgboost_pooled_feature.ipynb` (max_depth=6, learning_rate=0.1, early-stopped at 358 trees, with the `is_pooled` feature) is the one served by the API; `scripts/train_model.py` reproduces it as a standalone script and saves the artifacts to `models/`.

## Project structure

```
data/                   Raw and processed CSVs
notebooks/               All data prep, feature engineering, and modeling work
helper_functions/        prepare_train_test() — shared train/test split + encoding logic
scripts/train_model.py   Retrains the final model, saves to models/
models/                  Saved model + category encodings (gitignored, regenerate via train_model.py)
backend/main.py          FastAPI service exposing /next-ride
mobile/                  Expo Go React Native app — live ride feed + map detail view
```

## Running it

### 1. Train the model (if `models/` is empty)

```bash
uv run python scripts/train_model.py
```

### 2. Start the API

```bash
uv run uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` is required so a phone on the same Wi-Fi network can reach it — `localhost` only resolves on the machine running the server.

### 3. Run the mobile app

```bash
cd mobile
npm install
npx expo start
```

Before running, set `API_BASE_URL` in `mobile/App.tsx` to your machine's LAN IP (find it with `hostname -I` on Linux or `ipconfig getifaddr en0` on Mac) — Expo Go on a phone can't reach `localhost` on your laptop. Scan the QR code Expo prints with the Expo Go app.

### How "live" rides work

There's no real-time ride stream — this is a portfolio/demo project, not a production system. `/next-ride` samples one row at random from a held-out slice of the real historical dataset (the same time-based test split used during evaluation) every time it's called, and the app polls it every 10 seconds. The "live" feed is real historical rides being replayed, with the model's prediction shown alongside what was actually charged at the time.

## Known limitations

- **Pooled rides (`Shared`/`UberPool`) are poorly predicted.** Their pricing depends on co-rider count, which this dataset doesn't include. ~2x the error of every other tier.
- **The surge target is a proxy, not ground truth**, for Uber rides — validated against Lyft's real values, but not identical to it.
- **Single city, single 6-week window.** Boston, Nov–Dec 2018 — the model has not been validated on any other market or season.
- A gold-standard version of this project would use a multi-source pipeline like NYC TLC trip records fused with weather and true demand-supply signals; that was scoped out as too slow to build in 4 days and is a documented "what the ideal version looks like" rather than something attempted and abandoned.

## AI assistance

The mobile frontend (`mobile/`) was substantially generated by Claude Code. The author directed the tech stack (Expo/React Native), the feature set (live feed, map detail view, surge color-coding), and reviewed the result, but did not hand-write the React Native implementation.
