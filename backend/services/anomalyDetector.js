const MLService = require('./mlService');

class AnomalyDetector {
  constructor(options = {}) {
    // Use Python server approach (no ONNX dependency)
    this.mlService = new MLService({
      baseURL: options.baseURL || process.env.ML_SERVICE_URL || 'http://localhost:5001',
      timeout: options.timeout || 10000
    });
    
    this.usePythonServer = true;
  }

  async detect(records = []) {
    if (!records.length) {
      return [];
    }

    // Use Python ML server for anomaly detection
    try {
      const results = await this.mlService.detectAnomalies(records);
      
      // Python server returns array of records with anomaly_score and is_anomaly
      return results;
    } catch (error) {
      // Graceful degradation: if ML server unavailable, return records without anomaly flags
      console.warn('⚠️ [AnomalyDetector] ML server unavailable, continuing without anomaly detection', error.message);
      
      return records.map(record => ({
        ...record,
        anomalyScore: null,
        isAnomaly: false,
        mlServiceAvailable: false
      }));
    }
  }
}

module.exports = new AnomalyDetector();
module.exports.AnomalyDetector = AnomalyDetector;
