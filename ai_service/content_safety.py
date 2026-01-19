"""
Content Safety Module
Validates AI responses for safety, prompt injection, and content filtering
"""
import re
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class ContentSafetyChecker:
    """Validates AI-generated content for safety and security"""
    
    # Common prompt injection patterns
    PROMPT_INJECTION_PATTERNS = [
        r'ignore\s+(previous|above|all)\s+(instructions|rules|commands)',
        r'forget\s+(previous|above|all)',
        r'you\s+are\s+now\s+(a|an)\s+',
        r'disregard\s+(previous|above|all)',
        r'system\s*:\s*',
        r'<\|(system|admin|root)\|>',
        r'\[INST\]',
        r'\[SYSTEM\]',
        r'override\s+(safety|security|rules)',
        r'bypass\s+(safety|security|validation)',
        r'execute\s+(command|code|script)',
        r'eval\s*\(',
        r'exec\s*\(',
        r'<script',
        r'javascript:',
        r'onerror\s*=',
        r'onclick\s*=',
    ]
    
    # Dangerous content patterns
    DANGEROUS_PATTERNS = [
        r'<script[^>]*>',
        r'javascript:',
        r'on\w+\s*=',
        r'eval\s*\(',
        r'exec\s*\(',
        r'__import__',
        r'subprocess',
        r'os\.system',
        r'shell\s*=\s*True',
    ]
    
    # Sensitive data patterns (PII, credentials, etc.)
    SENSITIVE_PATTERNS = [
        r'\b\d{3}-\d{2}-\d{4}\b',  # SSN
        r'\b\d{16}\b',  # Credit card
        r'password\s*[:=]\s*\S+',
        r'api[_-]?key\s*[:=]\s*\S+',
        r'secret\s*[:=]\s*\S+',
        r'token\s*[:=]\s*\S+',
        r'bearer\s+\S+',
    ]
    
    def __init__(self):
        """Initialize content safety checker"""
        self.prompt_injection_regex = re.compile(
            '|'.join(self.PROMPT_INJECTION_PATTERNS),
            re.IGNORECASE | re.MULTILINE
        )
        self.dangerous_regex = re.compile(
            '|'.join(self.DANGEROUS_PATTERNS),
            re.IGNORECASE | re.MULTILINE
        )
        self.sensitive_regex = re.compile(
            '|'.join(self.SENSITIVE_PATTERNS),
            re.IGNORECASE | re.MULTILINE
        )
    
    def validate_input(self, user_input: str) -> Tuple[bool, Optional[str], Dict]:
        """
        Validate user input for prompt injection and dangerous content
        
        Args:
            user_input: User-provided input string
            
        Returns:
            Tuple of (is_safe, error_message, details)
        """
        if not user_input or not isinstance(user_input, str):
            return True, None, {}
        
        details = {
            'prompt_injection_detected': False,
            'dangerous_content_detected': False,
            'sensitive_data_detected': False,
            'matched_patterns': []
        }
        
        # Check for prompt injection
        prompt_injection_matches = self.prompt_injection_regex.findall(user_input)
        if prompt_injection_matches:
            details['prompt_injection_detected'] = True
            details['matched_patterns'].extend(prompt_injection_matches)
            logger.warning('[ContentSafety] Prompt injection detected in user input', {
                'matches': prompt_injection_matches[:3],  # Log first 3 matches
                'input_length': len(user_input)
            })
            return False, 'Invalid input detected. Please rephrase your request.', details
        
        # Check for dangerous content
        dangerous_matches = self.dangerous_regex.findall(user_input)
        if dangerous_matches:
            details['dangerous_content_detected'] = True
            details['matched_patterns'].extend(dangerous_matches)
            logger.warning('[ContentSafety] Dangerous content detected in user input', {
                'matches': dangerous_matches[:3],
                'input_length': len(user_input)
            })
            return False, 'Invalid input detected. Please rephrase your request.', details
        
        # Check for sensitive data (warn but don't block)
        sensitive_matches = self.sensitive_regex.findall(user_input)
        if sensitive_matches:
            details['sensitive_data_detected'] = True
            details['matched_patterns'].extend(sensitive_matches)
            logger.warning('[ContentSafety] Potential sensitive data detected in user input', {
                'matches': len(sensitive_matches),
                'input_length': len(user_input)
            })
            # Don't block, but log for security review
        
        return True, None, details
    
    def validate_output(self, ai_output: str, context: Optional[Dict] = None) -> Tuple[bool, Optional[str], Dict]:
        """
        Validate AI-generated output for safety and correctness
        
        Args:
            ai_output: AI-generated response string
            context: Optional context dictionary
            
        Returns:
            Tuple of (is_safe, error_message, details)
        """
        if not ai_output or not isinstance(ai_output, str):
            return True, None, {}
        
        details = {
            'dangerous_content_detected': False,
            'sensitive_data_detected': False,
            'output_length': len(ai_output),
            'matched_patterns': []
        }
        
        # Check for dangerous content in output
        dangerous_matches = self.dangerous_regex.findall(ai_output)
        if dangerous_matches:
            details['dangerous_content_detected'] = True
            details['matched_patterns'].extend(dangerous_matches)
            logger.error('[ContentSafety] Dangerous content detected in AI output', {
                'matches': dangerous_matches[:3],
                'output_length': len(ai_output)
            })
            # Sanitize output
            sanitized = self._sanitize_output(ai_output)
            return False, 'AI response contains potentially unsafe content. Response has been sanitized.', {
                **details,
                'sanitized_output': sanitized
            }
        
        # Check for sensitive data leakage (warn but don't block)
        sensitive_matches = self.sensitive_regex.findall(ai_output)
        if sensitive_matches:
            details['sensitive_data_detected'] = True
            details['matched_patterns'].extend(sensitive_matches)
            logger.warning('[ContentSafety] Potential sensitive data detected in AI output', {
                'matches': len(sensitive_matches),
                'output_length': len(ai_output)
            })
        
        return True, None, details
    
    def _sanitize_output(self, output: str) -> str:
        """
        Sanitize dangerous content from output
        
        Args:
            output: Output string to sanitize
            
        Returns:
            Sanitized output string
        """
        # Remove script tags
        sanitized = re.sub(r'<script[^>]*>.*?</script>', '[SCRIPT REMOVED]', output, flags=re.IGNORECASE | re.DOTALL)
        
        # Remove javascript: URLs
        sanitized = re.sub(r'javascript:', '[JAVASCRIPT REMOVED]', sanitized, flags=re.IGNORECASE)
        
        # Remove event handlers
        sanitized = re.sub(r'on\w+\s*=\s*["\'][^"\']*["\']', '[EVENT HANDLER REMOVED]', sanitized, flags=re.IGNORECASE)
        
        # Remove eval/exec calls
        sanitized = re.sub(r'eval\s*\([^)]*\)', '[EVAL REMOVED]', sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r'exec\s*\([^)]*\)', '[EXEC REMOVED]', sanitized, flags=re.IGNORECASE)
        
        return sanitized
    
    def check_response_quality(self, response: str, min_length: int = 10, max_length: int = 50000) -> Tuple[bool, Optional[str]]:
        """
        Check basic response quality metrics
        
        Args:
            response: Response string
            min_length: Minimum acceptable length
            max_length: Maximum acceptable length
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not response:
            return False, 'Empty response'
        
        if len(response) < min_length:
            return False, f'Response too short (minimum {min_length} characters)'
        
        if len(response) > max_length:
            return False, f'Response too long (maximum {max_length} characters)'
        
        # Check for excessive repetition (potential model failure)
        words = response.split()
        if len(words) > 100:
            word_counts = {}
            for word in words:
                word_counts[word] = word_counts.get(word, 0) + 1
            
            max_repetition = max(word_counts.values()) if word_counts else 0
            if max_repetition > len(words) * 0.3:  # More than 30% repetition
                return False, 'Response contains excessive repetition'
        
        return True, None


# Global instance
content_safety_checker = ContentSafetyChecker()

