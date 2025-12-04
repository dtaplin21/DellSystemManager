-- Telemetry Tables Migration
-- Creates tables for error tracking, cost metrics, and analytics

-- Cost metrics table
CREATE TABLE IF NOT EXISTS cost_metrics (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  user_tier VARCHAR(50) NOT NULL,
  service VARCHAR(100) NOT NULL,
  model VARCHAR(100),
  cost DECIMAL(10, 6) NOT NULL,
  tokens INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_metrics_user_id ON cost_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_user_tier ON cost_metrics(user_tier);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_created_at ON cost_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_service ON cost_metrics(service);

-- Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  error_name VARCHAR(255),
  context JSONB,
  environment VARCHAR(50) DEFAULT 'production',
  user_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_error_name ON error_logs(error_name);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_environment ON error_logs(environment);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(255) NOT NULL,
  properties JSONB,
  environment VARCHAR(50) DEFAULT 'production',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_environment ON analytics_events(environment);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(255) NOT NULL,
  metric_value DECIMAL(10, 2) NOT NULL,
  metric_unit VARCHAR(20) NOT NULL,
  tags JSONB,
  user_id VARCHAR(255),
  component VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_component ON performance_metrics(component);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cost_metrics_user_date ON cost_metrics(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_name_date ON error_logs(error_name, created_at);

