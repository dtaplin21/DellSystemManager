"""Python helper for anomaly detection."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List

import joblib
import pandas as pd

MODEL_DIR = Path(__file__).resolve().parent
MODEL_PATH = MODEL_DIR / "model.pkl"


class AnomalyDetector:
  def __init__(self, model_path: Path | None = None):
    self.model_path = Path(model_path or MODEL_PATH)
    self.model = None

  def load(self) -> "AnomalyDetector":
    if self.model is None:
      if not self.model_path.exists():
        raise FileNotFoundError(f"Model file not found at {self.model_path}")
      self.model = joblib.load(self.model_path)
    return self

  def _extract_features(self, records: List[dict]) -> pd.DataFrame:
    rows = []
    for record in records:
      mapped = record.get("mapped_data") or {}
      temperature = mapped.get("temperature") or mapped.get("wedgeTemp") or record.get("temperature")
      wedge_temp = mapped.get("wedgeTemp") or record.get("wedgeTemp")

      def _to_float(value):
        try:
          return float(value)
        except (TypeError, ValueError):
          return 0.0

      rows.append({
        "temperature": _to_float(temperature),
        "wedge_temp": _to_float(wedge_temp)
      })

    frame = pd.DataFrame(rows)
    if frame.empty:
      return frame

    return frame.fillna(0)

  def detect(self, records: Iterable[dict]) -> List[dict]:
    records = list(records)
    if not records:
      return []

    self.load()
    feature_frame = self._extract_features(records)
    if feature_frame.empty:
      return [
        {
          **records[idx],
          "anomaly_score": 0.0,
          "is_anomaly": False
        }
        for idx in range(len(records))
      ]

    scores = self.model.decision_function(feature_frame)
    return [
      {
        **records[idx],
        "anomaly_score": float(score),
        "is_anomaly": float(score) < 0
      }
      for idx, score in enumerate(scores)
    ]

  @classmethod
  def load_from_disk(cls, path: str | Path | None = None) -> "AnomalyDetector":
    detector = cls(path)
    detector.load()
    return detector
