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
    wait_timeout_ms: int = 60000  # Increased to 60 seconds to match navigation timeout and accommodate slow-rendering canvas elements
    allowed_upload_dirs: List[str] = field(default_factory=lambda: ["/tmp/uploads"])  # Allowed directories for file uploads

    # Memory management limits
    max_event_queue_size: int = 1000  # Maximum events in async queue before blocking
    max_recent_events: int = 200  # Maximum events stored in deque
    max_screenshot_size_mb: float = 10.0  # Maximum screenshot size in MB
    max_screenshots_stored: int = 5  # Maximum number of screenshots to keep in memory
    max_network_events: int = 200  # Maximum network requests/responses to store
    max_console_messages: int = 200  # Maximum console messages to store
    max_dom_mutations: int = 200  # Maximum DOM mutations to store
    max_websocket_messages: int = 200  # Maximum WebSocket messages to store

    # Operation timeouts
    navigation_timeout_ms: int = 60000  # Page navigation timeout (increased for slow-loading pages with WebSockets)
    action_timeout_ms: int = 10000  # Element interaction timeout
    screenshot_timeout_ms: int = 15000  # Screenshot capture timeout
    vision_analysis_timeout_ms: int = 60000  # Vision API timeout

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
