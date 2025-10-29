"""Utility script to run anomaly detection on sample records."""

import json
"""Utility script to run anomaly detection on sample records."""

import json
from pathlib import Path

from anomaly_detector import AnomalyDetector

MODEL_DIR = Path(__file__).resolve().parent


def main():
  sample_path = MODEL_DIR / "sample_records.json"
  if not sample_path.exists():
    raise SystemExit("Provide sample_records.json to run the detector")

  records = json.loads(sample_path.read_text())
  detector = AnomalyDetector.load_from_disk()
  enriched = detector.detect(records)
  print(json.dumps(enriched, indent=2))


if __name__ == "__main__":
  main()
