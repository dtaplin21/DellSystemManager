const fs = require('fs');
const path = require('path');
const ort = require('onnxruntime-node');

class AnomalyDetector {
  constructor(options = {}) {
    this.modelPath = options.modelPath || path.join(__dirname, '..', 'ml_models', 'anomaly_detector', 'model.onnx');
    this.session = null;
  }

  async ensureSession() {
    if (this.session) {
      return;
    }

    try {
      if (!fs.existsSync(this.modelPath)) {
        throw new Error(`ONNX model not found at ${this.modelPath}`);
      }
      this.session = await ort.InferenceSession.create(this.modelPath);
    } catch (error) {
      console.error('❌ [AnomalyDetector] Failed to load ONNX model', error.message);
      throw error;
    }
  }

  async detect(records = []) {
    if (!records.length) {
      return [];
    }

    await this.ensureSession();

    const features = records.map(record => {
      const mapped = record?.mapped_data || {};
      const rawTemp = mapped.temperature ?? mapped.wedgeTemp ?? record.temperature;
      const rawWedge = mapped.wedgeTemp ?? record.wedgeTemp ?? rawTemp;

      const temperature = Number.parseFloat(rawTemp);
      const wedgeTemp = Number.parseFloat(rawWedge);

      return [
        Number.isFinite(temperature) ? temperature : 0,
        Number.isFinite(wedgeTemp) ? wedgeTemp : 0
      ];
    });

    const flattened = features.flat();
    const tensor = new ort.Tensor('float32', Float32Array.from(flattened), [features.length, 2]);

    try {
      const results = await this.session.run({ input: tensor });
      const outputKey = Object.keys(results)[0];
      const output = results[outputKey];

      return records.map((record, index) => ({
        ...record,
        anomalyScore: output.data[index],
        isAnomaly: output.data[index] < 0
      }));
    } catch (error) {
      console.error('❌ [AnomalyDetector] Failed to run inference', error.message);
      throw error;
    }
  }
}

module.exports = new AnomalyDetector();
module.exports.AnomalyDetector = AnomalyDetector;
