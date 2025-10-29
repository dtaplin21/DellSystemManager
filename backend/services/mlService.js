const axios = require('axios');

class MLService {
  constructor(options = {}) {
    const baseURL = options.baseURL || process.env.ML_SERVICE_URL || 'http://localhost:5001';
    this.pythonServer = axios.create({
      baseURL,
      timeout: options.timeout || 5000
    });
  }

  async detectAnomalies(records) {
    try {
      const { data } = await this.pythonServer.post('/detect/anomalies', { records });
      return data;
    } catch (error) {
      console.error('❌ [MLService] Failed to detect anomalies', error.message);
      throw error;
    }
  }

  async predictQualityControl(data) {
    try {
      const response = await this.pythonServer.post('/predict/qc', { data });
      return response.data;
    } catch (error) {
      console.error('❌ [MLService] Failed QC prediction', error.message);
      throw error;
    }
  }
}

module.exports = MLService;
module.exports.default = MLService;
