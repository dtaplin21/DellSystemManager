"""Lightweight Flask server for hosting ML models."""

from __future__ import annotations

import logging
from typing import Any, Dict

from flask import Flask, jsonify, request

from anomaly_detector import AnomalyDetector

logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger("ml-server")

app = Flask(__name__)
DETECTOR = AnomalyDetector.load_from_disk()


@app.post("/detect/anomalies")
def detect_anomalies():
  payload = request.get_json(force=True)
  records = payload.get("records", [])
  LOGGER.info("Processing %s records for anomaly detection", len(records))
  detections = DETECTOR.detect(records)
  return jsonify([
    {
      **record,
      "anomaly_score": result.anomaly_score,
      "is_anomaly": result.is_anomaly,
    }
    for record, result in zip(records, detections)
  ])


@app.post("/predict/qc")
def predict_qc():
  payload: Dict[str, Any] = request.get_json(force=True)
  LOGGER.info("Received QC prediction request: keys=%s", list(payload.keys()))
  # Placeholder response until QC predictor is implemented
  return jsonify({
    "prediction": payload,
    "confidence": 0.5,
    "status": "not_trained"
  })


if __name__ == "__main__":
  app.run(host="0.0.0.0", port=5001)
