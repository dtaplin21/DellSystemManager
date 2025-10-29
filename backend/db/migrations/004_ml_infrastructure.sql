-- Prompt performance tracking for versioned prompts
CREATE TABLE IF NOT EXISTS prompt_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  success BOOLEAN,
  user_corrections JSONB,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_performance_prompt ON prompt_performance(prompt_id, version);
CREATE INDEX IF NOT EXISTS idx_prompt_performance_created ON prompt_performance(created_at);

-- Learned header mappings grouped by user/domain
CREATE TABLE IF NOT EXISTS import_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  domain VARCHAR(50) NOT NULL,
  header_mapping JSONB,
  success_rate DECIMAL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  corrections JSONB,
  UNIQUE (user_id, domain)
);

-- Store model accuracy vs. user corrections
CREATE TABLE IF NOT EXISTS ai_accuracy_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES asbuilt_records(id),
  predicted_value JSONB,
  user_corrected_value JSONB,
  domain VARCHAR(50),
  was_accepted BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_accuracy_log_domain ON ai_accuracy_log(domain, created_at DESC);

-- Registered ML models deployed in the platform
CREATE TABLE IF NOT EXISTS ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  model_type VARCHAR(50) NOT NULL,
  file_path TEXT,
  accuracy DECIMAL,
  baseline_accuracy DECIMAL,
  trained_at TIMESTAMP WITH TIME ZONE,
  training_data_size INTEGER,
  last_retrained_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Capture every prediction for auditing and drift analysis
CREATE TABLE IF NOT EXISTS ml_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES ml_models(id),
  user_id UUID REFERENCES users(id),
  input_data JSONB,
  prediction JSONB,
  confidence DECIMAL,
  actual_outcome JSONB,
  was_correct BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_user ON ml_predictions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_model ON ml_predictions(model_id, created_at);

-- High level audit events for ML lifecycle operations
CREATE TABLE IF NOT EXISTS ml_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES ml_models(id),
  action VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  data_snapshot JSONB,
  result JSONB,
  confidence DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_audit_user ON ml_audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ml_audit_action ON ml_audit_log(action, created_at);
