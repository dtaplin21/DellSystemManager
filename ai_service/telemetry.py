"""
Telemetry Service for AI Service
Tracks errors, performance, and cost metrics
"""

import os
import logging
import json
import requests
from typing import Dict, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)

class TelemetryService:
    """Telemetry service for tracking errors, performance, and costs"""
    
    def __init__(self, backend_url: Optional[str] = None):
        self.backend_url = backend_url or os.getenv('BACKEND_URL', 'http://localhost:8003')
        self.enabled = os.getenv('TELEMETRY_ENABLED', 'true').lower() == 'true'
        self.environment = os.getenv('ENVIRONMENT', 'development')
        
    def track_cost(
        self,
        user_id: str,
        user_tier: str,
        service: str,
        cost: float,
        model: Optional[str] = None,
        tokens: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Track cost metrics"""
        if not self.enabled:
            return
            
        try:
            cost_data = {
                'userId': user_id,
                'userTier': user_tier,
                'service': service,
                'cost': cost,
                'model': model,
                'tokens': tokens,
                'metadata': metadata or {}
            }
            
            response = requests.post(
                f'{self.backend_url}/api/telemetry/cost',
                json={'costs': [cost_data]},
                timeout=2
            )
            
            if response.status_code != 200:
                logger.warning(f'Failed to track cost: {response.status_code}')
        except Exception as e:
            # Silently fail - telemetry shouldn't break the app
            logger.debug(f'Telemetry cost tracking failed: {e}')
    
    def track_error(
        self,
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
    ):
        """Track errors"""
        if not self.enabled:
            return
            
        try:
            error_data = {
                'message': str(error),
                'stack': self._get_stack_trace(error),
                'name': type(error).__name__,
                'context': context or {},
                'environment': self.environment,
                'userId': user_id
            }
            
            response = requests.post(
                f'{self.backend_url}/api/telemetry/errors',
                json={'errors': [error_data]},
                timeout=2
            )
            
            if response.status_code != 200:
                logger.warning(f'Failed to track error: {response.status_code}')
        except Exception as e:
            # Silently fail - telemetry shouldn't break the app
            logger.debug(f'Telemetry error tracking failed: {e}')
    
    def track_performance(
        self,
        metric_name: str,
        value: float,
        unit: str = 'ms',
        tags: Optional[Dict[str, str]] = None,
        user_id: Optional[str] = None,
        component: Optional[str] = None
    ):
        """Track performance metrics"""
        if not self.enabled:
            return
            
        try:
            metric_data = {
                'metricName': metric_name,
                'metricValue': value,
                'metricUnit': unit,
                'tags': tags or {},
                'userId': user_id,
                'component': component,
                'timestamp': int(datetime.now().timestamp() * 1000)
            }
            
            # For now, just log performance metrics
            # Can be extended to send to backend if needed
            logger.debug(f'Performance metric: {metric_name}={value}{unit}', extra=metric_data)
        except Exception as e:
            logger.debug(f'Telemetry performance tracking failed: {e}')
    
    def _get_stack_trace(self, error: Exception) -> str:
        """Get stack trace from exception"""
        import traceback
        return ''.join(traceback.format_exception(type(error), error, error.__traceback__))

# Singleton instance
_telemetry_instance: Optional[TelemetryService] = None

def get_telemetry() -> TelemetryService:
    """Get or create telemetry service instance"""
    global _telemetry_instance
    if _telemetry_instance is None:
        _telemetry_instance = TelemetryService()
    return _telemetry_instance

