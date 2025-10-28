# Machine Learning Implementation Plan for DellSystemManager

## Executive Summary

This document outlines a comprehensive 3-phase approach to integrate machine learning capabilities into the DellSystemManager platform, moving from enhanced AI prompts to lightweight ML models to advanced deep learning, all while maintaining the existing UI and user experience.

**Key Changes from Previous Version:**
- ✅ Added data volume reality check and minimum requirements
- ✅ Added prompt versioning and A/B testing
- ✅ Switched from spawn to persistent Python server (faster)
- ✅ Added ONNX runtime option for Node.js inference (no Python needed)
- ✅ Reordered Phase 2 by ROI priority
- ✅ Added model monitoring and retraining infrastructure
- ✅ Added cost estimates
- ✅ Added compliance/auditing tables
- ✅ Deferred Phase 3 CV/RL features until ROI proven
- ✅ Prioritized data collection phase upfront

---

## 📊 Data Volume Reality Check

**RUN THIS FIRST BEFORE COMMITTING TO PHASE 2/3:**

```javascript
// backend/scripts/data-audit.js
// Run this diagnostic query to assess data availability
const dataAudit = await db.query(`
  SELECT 
    domain,
    COUNT(*) as record_count,
    COUNT(DISTINCT project_id) as project_count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest,
    EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/86400 as days_span
  FROM asbuilt_records
  GROUP BY domain
  ORDER BY record_count DESC
`);

console.log('Data Availability Assessment:');
console.log(dataAudit);

// Minimum viable data:
// - Phase 2 ML models: ~1,000 records per domain
// - Phase 3 BERT: ~5,000+ labeled examples  
// - Phase 3 CV: ~500+ annotated images per defect type
```

**Decision Matrix**:
- If data < 1,000 records per domain → Defer Phase 2, focus on Phase 1b (data collection)
- If data < 5,000 records → Skip BERT fine-tuning, use simpler NLP
- If no images → Skip CV entirely

---

## Phase 1a: Prompt Engineering & Versioning (Week 1-2)

### Objective
Improve existing AI capabilities without adding trained models, with measurable ROI tracking.

### Tasks

#### 1.1 Domain-Specific Prompt Engineering + Versioning
**Location**: `backend/services/prompt-templates/`

**Files to Create**:
```
backend/services/prompt-templates/
├── base.js              # Prompt versioning system
├── panel-placement-prompt.js
├── panel-seaming-prompt.js
├── non-destructive-prompt.js
├── repairs-prompt.js
└── destructive-prompt.js
```

**New: Prompt Versioning System**:
```javascript
// backend/services/prompt-templates/base.js
const { Pool } = require('pg');

class PromptVersionManager {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }

  async trackUsage(promptId, version, success, corrections, metadata) {
    await this.pool.query(`
      INSERT INTO prompt_performance (
        prompt_id, version, success, user_corrections, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [promptId, version, success, corrections, JSON.stringify(metadata)]);
  }

  async getBestVersion(promptId) {
    const result = await this.pool.query(`
      SELECT version, AVG(success::int) as success_rate, COUNT(*) as usage_count
      FROM prompt_performance
      WHERE prompt_id = $1
      GROUP BY version
      ORDER BY success_rate DESC, usage_count DESC
      LIMIT 1
    `, [promptId]);
    
    return result.rows[0];
  }

  async compareVersions(promptId) {
    const result = await this.pool.query(`
      SELECT 
        version,
        AVG(success::int) as success_rate,
        AVG((user_corrections::jsonb->>'count')::int) as avg_corrections,
        COUNT(*) as usage_count
      FROM prompt_performance
      WHERE prompt_id = $1
      GROUP BY version
      ORDER BY success_rate DESC
    `, [promptId]);
    
    return result.rows;
  }
}

module.exports = PromptVersionManager;
```

**Prompt Template with Versioning**:
```javascript
// backend/services/prompt-templates/panel-seaming-prompt.js
const PromptVersion = {
  id: 'panel_seaming',
  version: '1.0',
  created: '2025-01-28',
  accuracy_baseline: null, // Will track over time
  improvements: [
    'Added few-shot learning examples',
    'Added field format specifications',
    'Added confidence scoring'
  ]
};

const panelSeamingPrompt = {
  system: `You are an expert in geosynthetic panel seaming quality control.

DOMAIN: Panel Seaming

KNOWN FIELD PATTERNS:
- Panel Numbers: Can be "P54", "54", "54/62" (paired panels)
- Seam Types: W, Auto, J-V
- Temperature: Critical (140-180°F range)
- Operators: Certification initials required

FEW-SHOT EXAMPLES:
Example 1:
  Headers: ["Panel Numbers", "Seam Type", "Temp", "Operator"]
  Output: { "mapping": {"Panel Numbers": "panelNumber", "Seam Type": "seamType", "Temp": "temperature", "Operator": "operator"}, "confidence": 0.95 }

Example 2:
  Headers: ["Panel #", "Seam Type", "Temperature (F)", "Seamer Initials"]
  Output: { "mapping": {"Panel #": "panelNumber", "Seam Type": "seamType", "Temperature (F)": "temperature", "Seamer Initials": "seamerInitials"}, "confidence": 0.90 }

HEADERS TO MAP: {headers}

Return JSON:
{
  "mapping": {"actual header": "canonical field"},
  "confidence": 0.0-1.0,
  "domain": "panel_seaming",
  "reasoning": "brief explanation"
}`,
  version: PromptVersion
};

module.exports = panelSeamingPrompt;
```

**Database Schema for Prompt Tracking**:
```sql
-- Track prompt performance for A/B testing
CREATE TABLE prompt_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id VARCHAR(100),
  version VARCHAR(20),
  success BOOLEAN,
  user_corrections JSONB, -- What user changed after AI
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  user_id UUID REFERENCES users(id)
);

CREATE INDEX idx_prompt_performance_prompt ON prompt_performance(prompt_id, version);
CREATE INDEX idx_prompt_performance_created ON prompt_performance(created_at);
```

#### 1.2 Context-Aware AI Analysis (Enhanced)
**Location**: `backend/services/duplicateDetectionService.js`

**Changes**:
- Add project history context
- Include user behavior patterns
- Track what users typically correct

---

## Phase 1b: Historical Patterns + Data Collection (Week 3-4)

### Critical: Data Collection Strategy
**Before Phase 2, we need labeled training data.**

**Tasks**:
1. **Implement Data Labeling UI** (minimal - optional badges)
   - Add "AI Predicted" badge to imports
   - Track user corrections
   - Store corrections as training labels

2. **Historical Pattern Learning**
   ```javascript
   // backend/services/historical-patterns.js
   class HistoricalPatternLearner {
     async learnFromCorrections() {
       // Get all user corrections from ai_accuracy_log
       const corrections = await db.query(`
         SELECT 
           import_id,
           predicted_value,
           user_corrected_value,
           domain,
           CASE 
             WHEN predicted_value::jsonb = user_corrected_value::jsonb 
             THEN TRUE 
             ELSE FALSE 
           END as was_correct
         FROM ai_accuracy_log
         WHERE created_at > NOW() - INTERVAL '30 days'
       `);
       
       // Group by domain and field
       const patterns = this.groupByField(corrections);
       
       // Update import patterns table
       for (let pattern of patterns) {
         await this.updateImportPattern(pattern);
       }
     }
   }
   ```

3. **Prompt A/B Testing**
   ```javascript
   // Automatically test new prompt versions
   async function ABTestPrompt(newPrompt, oldPrompt) {
     // 50/50 split of users
     const useNew = Math.random() > 0.5;
     const prompt = useNew ? newPrompt : oldPrompt;
     
     // Track which version performs better
     const result = await callAI(prompt);
     await trackPromptPerformance(useNew ? 'new' : 'old', result);
   }
   ```

**Database Schema**:
```sql
CREATE TABLE import_patterns (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  domain VARCHAR(50),
  header_mapping JSONB,
  success_rate DECIMAL,
  last_used_at TIMESTAMP,
  corrections JSONB
);

CREATE TABLE ai_accuracy_log (
  id UUID PRIMARY KEY,
  import_id UUID REFERENCES asbuilt_records(id),
  predicted_value JSONB,
  user_corrected_value JSONB,
  domain VARCHAR(50),
  was_accepted BOOLEAN,
  created_at TIMESTAMP
);
```

### Success Criteria
- Collect 1,000+ labeled examples per domain
- Track at least 200 user corrections
- Establish baseline AI accuracy metrics
- Generate first A/B test results

---

## Phase 2a: Anomaly Detection (Week 5-6) - HIGH PRIORITY

### Objective
Detect unusual QC measurements that may indicate errors or fraud.

### Why First?
- **Highest immediate value** (catches fraud/errors)
- **Low data requirements** (unsupervised learning)
- **Clear ROI** (reduces liability)
- **No labeled data needed**

### Model: Isolation Forest (Unsupervised)

**Location**: `backend/ml_models/anomaly_detector/`

**Files**:
```
backend/ml_models/anomaly_detector/
├── train_model.py
├── detect.py
├── model.pkl
└── requirements.txt
```

**Implementation**:
```python
# backend/ml_models/anomaly_detector/train_model.py
from sklearn.ensemble import IsolationForest
import pandas as pd
import joblib
import os

def train_anomaly_detector():
    """Train unsupervised anomaly detection model"""
    
    query = """
        SELECT 
            (mapped_data->>'temperature')::float as temperature,
            (mapped_data->>'vboxPassFail') as pass_fail,
            (mapped_data->>'panelNumber') as panel_number,
            domain
        FROM asbuilt_records
        WHERE mapped_data IS NOT NULL
        AND domain IN ('panel_seaming', 'non_destructive')
    """
    
    df = pd.read_sql(query, conn)
    
    # Feature engineering
    df['temperature'] = pd.to_numeric(df['temperature'], errors='coerce')
    df = df.dropna()
    
    # Train Isolation Forest
    model = IsolationForest(contamination=0.05, random_state=42)
    model.fit(df[['temperature']])
    
    # Save
    joblib.dump(model, 'model.pkl')
    print("Anomaly detector trained")
```

**Integration** (ONNX for Node.js - No Python spawn):
```javascript
// backend/services/anomalyDetector.js
const onnx = require('onnxruntime-node');

class AnomalyDetector {
  async loadModel() {
    // Load ONNX model (converted from sklearn)
    this.session = await onnx.InferenceSession.create('./ml_models/anomaly_detector/model.onnx');
  }
  
  async detect(records) {
    const features = records.map(r => [
      parseFloat(r.mapped_data.temperature) || 0
    ]);
    
    const tensor = new onnx.Tensor('float32', features, [features.length, 1]);
    const results = await this.session.run({ input: tensor });
    
    return records.map((r, i) => ({
      ...r,
      is_anomaly: results.output.data[i] < 0,
      anomaly_score: results.output.data[i]
    }));
  }
}
```

**Alternative: Python Persistent Server**:
```javascript
// backend/services/mlService.js
class MLService {
  constructor() {
    // Keep Python process alive (faster than spawn each time)
    this.pythonServer = axios.create({
      baseURL: 'http://localhost:5001',
      timeout: 5000
    });
  }
  
  async detectAnomalies(records) {
    const response = await this.pythonServer.post('/detect/anomalies', { records });
    return response.data;
  }
  
  async predictQC(data) {
    const response = await this.pythonServer.post('/predict/qc', { data });
    return response.data;
  }
}

// Python server: backend/ml_models/server.py
from flask import Flask, request, jsonify
from anomaly_detector import AnomalyDetector

app = Flask(__name__)
detector = AnomalyDetector.load('model.pkl')

@app.post('/detect/anomalies')
def detect():
    records = request.json['records']
    anomalies = detector.detect(records)
    return jsonify(anomalies)

if __name__ == '__main__':
    app.run(port=5001)
```

---

## Phase 2b: QC Outcome Prediction (Week 7-9) - HIGH PRIORITY

### Objective
Predict pass/fail outcomes to catch issues before they occur.

### Model: Scikit-learn Gradient Boosting

**Location**: `backend/ml_models/qc_predictor/`

**Requirements**: 1,000+ records with outcomes

**Integration**: Same as anomaly detector (ONNX or Python server)

---

## Phase 2c: Waste Prediction (Week 10-11) - MEDIUM PRIORITY

### Objective
Predict material waste based on historical panel layouts.

**Defer if**: Waste is not a major pain point for users.

---

## Phase 3a: NLP Domain Classifier (Week 12-14) - MEDIUM PRIORITY

### Prerequisites
- ✅ 5,000+ labeled examples
- ✅ Proved ROI from Phase 1-2
- ✅ Budget for GPU training (one-time $200-500)

### Model: Fine-tuned BERT

**Location**: `backend/ml_models/nlp_classifier/`

**Defer if data requirements not met**.

---

## Phase 3b: Time Series Forecasting (Week 15-16) - LOW PRIORITY

### Model: LSTM

**Defer until after proving ROI from 3a**.

---

## Phase 3c & 3d: DEFERRED

### Computer Vision & Reinforcement Learning
**Status**: Separate future projects after proving ROI

**Why Deferred**:
- CV requires 1,000+ annotated images (expensive)
- RL requires complex reward functions
- Low adoption risk if not building on existing workflow

**Decision**: Build only if users explicitly request photo uploads.

---

## 🔧 Infrastructure: Model Monitoring & Retraining

### Critical Addition: Model Health Monitoring

**Location**: `backend/services/mlMonitor.js`

```javascript
class ModelMonitor {
  async checkModelDrift() {
    // Compare recent predictions vs. actual outcomes
    const recentAccuracy = await db.query(`
      SELECT 
        model_id,
        AVG(CASE WHEN prediction = actual_outcome THEN 1 ELSE 0 END) as accuracy
      FROM ml_predictions
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY model_id
    `);
    
    for (let model of recentAccuracy) {
      if (model.accuracy < model.baseline - 0.1) {
        console.warn(`Model ${model.model_id} degraded by ${model.baseline - model.accuracy}`);
        await this.triggerRetrain(model.model_id);
      }
    }
  }
  
  async triggerRetrain(modelId) {
    // Queue retraining job
    await queue.add('retrain-model', { 
      modelId,
      priority: 'high',
      reason: 'Accuracy degradation detected'
    });
  }
  
  async generateReport() {
    // Weekly model health report
    const report = {
      models: await this.getAllModels(),
      accuracy_trends: await this.getAccuracyTrends(),
      predictions_count: await this.getPredictionCounts(),
      anomalies_detected: await this.getAnomaliesCount()
    };
    
    await this.sendReportToAdmin(report);
  }
}

// Run weekly
setInterval(() => {
  mlMonitor.checkModelDrift();
  mlMonitor.generateReport();
}, 7 * 24 * 60 * 60 * 1000); // 7 days
```

**Database Schema**:
```sql
CREATE TABLE ml_audit_log (
  id UUID PRIMARY KEY,
  model_id UUID REFERENCES ml_models(id),
  action VARCHAR(50), -- 'train', 'predict', 'retrain', 'deploy'
  user_id UUID,
  data_snapshot JSONB,
  result JSONB,
  created_at TIMESTAMP
);

CREATE TABLE ml_models (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  version VARCHAR(20),
  model_type VARCHAR(50),
  file_path TEXT,
  accuracy DECIMAL,
  baseline_accuracy DECIMAL,
  trained_at TIMESTAMP,
  training_data_size INTEGER,
  last_retrained_at TIMESTAMP,
  status VARCHAR(20) -- 'active', 'deprecated', 'retraining'
);
```

---

## 💰 Cost Estimates

### Phase 1 (Weeks 1-4)
- **Cost**: $0 (uses existing OpenAI)
- **Savings**: Potential 20% reduction in OpenAI calls through better prompts

### Phase 2 (Weeks 5-11)
- **One-time**: $50 (GPU training on cloud spot instances)
- **Monthly**: 
  - Python hosting: $50-100/month (if using separate ML server)
  - Storage for models: $10/month
  - Compute for retraining: $20/month
- **Total Monthly**: $80-130/month
- **Savings**: $500-1,500/month in reduced OpenAI costs

### Phase 3 (Weeks 12-16)
- **One-time**: $200-500 (BERT/YOLO training)
- **Monthly**: $100-200/month (increased compute)
- **Savings**: $1,000-3,000/month (major reduction in OpenAI usage)

### Annual ROI Estimate
- **Cost**: ~$3,000/year
- **Savings**: $10,000-50,000/year in OpenAI costs
- **Net**: +$7,000 to +$47,000/year

**Note**: Costs assume on-premise ML hosting. Cloud ML (AWS SageMaker) would be $500-1,000/month.

---

## 🎯 Revised Timeline by Priority

| Phase | Duration | Priority | Requires Data? | UI Impact |
|-------|----------|----------|----------------|-----------|
| 1a: Prompt Engineering | Week 1-2 | MUST HAVE | ❌ No | None |
| 1b: Data Collection | Week 3-4 | MUST HAVE | ❌ Collecting | Minimal badges |
| 2a: Anomaly Detection | Week 5-6 | HIGH | ✅ 100+ records | None (flags in backend) |
| 2b: QC Prediction | Week 7-9 | HIGH | ✅ 1,000+ records | None |
| 2c: Waste Prediction | Week 10-11 | MEDIUM | ✅ Layout data | None |
| 3a: NLP Classifier | Week 12-14 | MEDIUM | ✅ 5,000+ records | None |
| 3b: Forecasting | Week 15-16 | LOW | ✅ Timeline data | None |
| 3c: CV Defect Detection | Future | DEFER | ✅ 500+ images | Photo upload |
| 3d: RL Optimization | Future | DEFER | ✅ User patterns | None |

**Total Commitment**: 16 weeks (can stop after any phase if ROI isn't there)

---

## 📊 Success Metrics (Track Weekly)

### Phase 1
- AI accuracy: +15-20%
- Duplicate false positives: -25%
- User corrections: -30%
- Prompt A/B test winners identified

### Phase 2
- Anomaly detection: 80% of fraud/errors caught
- QC prediction accuracy: > 75%
- Waste prediction within 10%

### Phase 3
- Domain classification: > 90%
- Forecast accuracy: within 5 days

### Overall
- OpenAI cost reduction: 30-50%
- Time saved per user: 2 hours/week
- **ROI**: Positive after 6 months

---

## 🔒 Compliance & Auditing

### Database Schema Additions
```sql
CREATE TABLE ml_audit_log (
  id UUID PRIMARY KEY,
  model_id UUID REFERENCES ml_models(id),
  action VARCHAR(50),
  user_id UUID REFERENCES users(id),
  data_snapshot JSONB, -- For compliance
  result JSONB,
  confidence DECIMAL,
  created_at TIMESTAMP
);

-- Track all model predictions for GDPR compliance
CREATE TABLE ml_predictions (
  id UUID PRIMARY KEY,
  model_id UUID REFERENCES ml_models(id),
  user_id UUID REFERENCES users(id),
  input_data JSONB,
  prediction JSONB,
  confidence DECIMAL,
  actual_outcome JSONB,
  was_correct BOOLEAN,
  created_at TIMESTAMP
);

CREATE INDEX idx_ml_predictions_user ON ml_predictions(user_id, created_at);
CREATE INDEX idx_ml_audit_user ON ml_audit_log(user_id, created_at);
```

### Audit Trail Example
```javascript
async function logMLPrediction(modelId, userId, input, prediction) {
  await db.query(`
    INSERT INTO ml_predictions (
      model_id, user_id, input_data, prediction, confidence, created_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
  `, [modelId, userId, JSON.stringify(input), JSON.stringify(prediction), prediction.confidence]);
  
  // Also log to audit
  await db.query(`
    INSERT INTO ml_audit_log (model_id, user_id, action, data_snapshot, result, created_at)
    VALUES ($1, $2, 'predict', $3, $4, NOW())
  `, [modelId, userId, JSON.stringify(input), JSON.stringify(prediction)]);
}
```

---

## 🚀 Next Steps

1. **Approve this revised plan**
2. **Run data audit** (`backend/scripts/data-audit.js`)
3. **Start Phase 1a immediately** (prompt engineering - no dependencies)
4. **Deploy data collection** (Phase 1b - start gathering training data)
5. **Re-evaluate after Phase 1b** (decide on Phase 2 based on actual data)
6. **Stop/go decision** after each phase based on ROI

**Key Changes Summary**:
- ✅ Added data volume reality check
- ✅ Added prompt versioning and A/B testing  
- ✅ Added ONNX option (Node.js inference)
- ✅ Added Python persistent server option
- ✅ Reordered Phase 2 by ROI
- ✅ Added model monitoring infrastructure
- ✅ Added cost estimates
- ✅ Added compliance/auditing tables
- ✅ Deferred Phase 3c/3d until ROI proven
- ✅ Made Phase 1b (data collection) explicit priority
