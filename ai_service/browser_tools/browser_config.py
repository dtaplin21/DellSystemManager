"""Security and runtime configuration for browser automation tools."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, List, Optional
from urllib.parse import urlparse


@dataclass
class BrowserSecurityConfig:
    """Configuration that governs browser automation safeguards."""

    allowed_domains: List[str] = field(default_factory=list)
    blocked_domains: List[str] = field(default_factory=list)
    max_pages_per_session: int = 50
    max_session_duration_minutes: int = 30
    rate_limit_per_minute: int = 60
    require_authentication: bool = False
    enable_screenshots: bool = True
    log_actions: bool = True
    wait_timeout_ms: int = 30000  # Default 30 seconds for element waits
    allowed_upload_dirs: List[str] = field(default_factory=lambda: ["/tmp/uploads"])  # Allowed directories for file uploads

    def is_url_allowed(self, url: str) -> bool:
        """Return True when the supplied URL is permitted by the policy."""

        parsed = urlparse(url)
        domain = parsed.netloc  # This includes port, e.g., "localhost:3000"
        if not domain:
            return False

        if self.blocked_domains and domain in self.blocked_domains:
            return False

        # If no allowed domains specified, allow all (for development)
        if not self.allowed_domains:
            return True

        # Check exact match first (includes port)
        if domain in self.allowed_domains:
            return True
        
        # Also check without port for flexibility
        domain_without_port = domain.split(':')[0]
        allowed_without_ports = [d.split(':')[0] for d in self.allowed_domains]
        if domain_without_port in allowed_without_ports:
            return True

        return False

    @classmethod
    def from_env(cls, allowed: Optional[Iterable[str]] = None) -> "BrowserSecurityConfig":
        """Construct a config using environment-derived defaults."""

        allowed_domains = list(allowed or [])
        return cls(allowed_domains=allowed_domains)
