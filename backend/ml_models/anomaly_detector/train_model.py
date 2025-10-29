"""Train an Isolation Forest anomaly detector and export to ONNX."""

import os
from pathlib import Path

import joblib
import pandas as pd
import psycopg2
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

DATABASE_URL = os.getenv("DATABASE_URL")
MODEL_DIR = Path(__file__).resolve().parent
MODEL_PATH = MODEL_DIR / "model.pkl"
ONNX_PATH = MODEL_DIR / "model.onnx"

QUERY = """
    SELECT
        (mapped_data->>'temperature')::float AS temperature,
        (mapped_data->>'wedgeTemp')::float AS wedge_temp,
        domain
    FROM asbuilt_records
    WHERE mapped_data IS NOT NULL
      AND domain IN ('panel_seaming', 'non_destructive')
"""


def fetch_dataframe():
  """Load panel seaming data from Postgres into a DataFrame."""
  if not DATABASE_URL:
    raise EnvironmentError("DATABASE_URL is required to train the anomaly detector")

  with psycopg2.connect(DATABASE_URL) as conn:
    return pd.read_sql_query(QUERY, conn)


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
  """Select features and handle missing values."""
  df = df.copy()
  df["temperature"] = pd.to_numeric(df["temperature"], errors="coerce")
  df["wedge_temp"] = pd.to_numeric(df["wedge_temp"], errors="coerce")
  df = df.dropna(subset=["temperature"]).fillna(0)
  return df[["temperature", "wedge_temp"]]


def train_model(features: pd.DataFrame) -> Pipeline:
  """Train an IsolationForest wrapped in a preprocessing pipeline."""
  pipeline = Pipeline([
    ("scale", StandardScaler()),
    ("model", IsolationForest(contamination=0.05, random_state=42))
  ])
  pipeline.fit(features)
  return pipeline


def export_pipeline(pipeline: Pipeline) -> None:
  """Persist the trained model to disk and export to ONNX."""
  MODEL_DIR.mkdir(parents=True, exist_ok=True)
  joblib.dump(pipeline, MODEL_PATH)

  onnx_model = convert_sklearn(
    pipeline,
    initial_types=[("input", FloatTensorType([None, pipeline.n_features_in_]))],
    target_opset=15
  )
  ONNX_PATH.write_bytes(onnx_model.SerializeToString())


if __name__ == "__main__":
  print("🔄 Loading training data...")
  frame = fetch_dataframe()

  if frame.empty:
    raise RuntimeError("No training data available for anomaly detector")

  print(f"📈 Loaded {len(frame)} rows")
  X = prepare_features(frame)
  print("🤖 Training Isolation Forest...")
  model = train_model(X)
  export_pipeline(model)
  print(f"✅ Model saved to {MODEL_PATH} and {ONNX_PATH}")
