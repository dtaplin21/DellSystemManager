"""Vision-based analysis of browser screenshots using multimodal models."""

from __future__ import annotations

import asyncio
import base64
import logging
from typing import Any, Optional

import nest_asyncio
from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

# Apply nest_asyncio to allow nested event loops (fixes CrewAI threading conflicts)
nest_asyncio.apply()

logger = logging.getLogger(__name__)


class BrowserVisionAnalysisTool(BaseTool):
    """Analyze browser screenshots with a vision-capable language model."""

    name: str = "browser_vision_analyze"
    description: str = (
        "Capture or reuse screenshots and analyze them with a vision model to "
        "detect UI state, errors, or visual changes."
    )
    session_manager: Any = None
    openai_service: Any = None
    default_prompt: str = "Describe the visible UI, highlight changes, and note any errors or warnings."

    def __init__(
        self,
        session_manager: BrowserSessionManager,
        openai_service,
        default_prompt: str = "Describe the visible UI, highlight changes, and note any errors or warnings.",
    ) -> None:
        super().__init__()
        self.session_manager = session_manager
        self.openai_service = openai_service
        self.default_prompt = default_prompt
        # Force schema creation and rebuild to resolve Optional forward references
        # CrewAI's BaseTool creates schema lazily, so we need to access it first
        self._ensure_schema_rebuilt()
    
    def _ensure_schema_rebuilt(self):
        """Ensure the Pydantic schema is created and rebuilt to resolve ForwardRefs."""
        try:
            # Force schema creation by accessing it
            if hasattr(self, 'args_schema'):
                schema = self.args_schema
                if schema is not None:
                    # Rebuild with proper namespace that includes Optional
                    # This resolves ForwardRef('Optional[str]') to Optional[str]
                    from typing import Optional, Union
                    # Create namespace with required types
                    types_namespace = {
                        'Optional': Optional,
                        'Union': Union,
                        'str': str,
                        'int': int,
                        'float': float,
                        'bool': bool,
                        'Any': Any,
                    }
                    # Rebuild schema with types namespace
                    schema.model_rebuild(_types_namespace=types_namespace)
                    # Also rebuild the tool model itself
                    if hasattr(self, 'model_rebuild'):
                        self.model_rebuild()
        except (AttributeError, Exception) as e:
            logger.debug(f"Schema rebuild skipped (may not be created yet): {e}")

    def _run(
        self,
        question: Optional[str] = None,
        screenshot_base64: Optional[str] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
        selector: Optional[str] = None,
        full_page: bool = True,
    ) -> str:
        try:
            return asyncio.run(
                self._arun(
                    question=question,
                    screenshot_base64=screenshot_base64,
                    session_id=session_id,
                    user_id=user_id,
                    tab_id=tab_id,
                    selector=selector,
                    full_page=full_page,
                )
            )
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(
                    self._arun(
                        question=question,
                        screenshot_base64=screenshot_base64,
                        session_id=session_id,
                        user_id=user_id,
                        tab_id=tab_id,
                        selector=selector,
                        full_page=full_page,
                    )
                )
            finally:
                loop.close()

    async def _arun(
        self,
        question: Optional[str] = None,
        screenshot_base64: Optional[str] = None,
        session_id: str = "default",
        user_id: Optional[str] = None,
        tab_id: Optional[str] = None,
        selector: Optional[str] = None,
        full_page: bool = True,
    ) -> str:
        session = None
        try:
            # Validate OpenAI service availability
            if not self.openai_service or not getattr(self.openai_service, 'api_key', None):
                return "Error: Vision analysis unavailable - OpenAI service not configured"

            session = await self.session_manager.get_session(session_id, user_id)
            image_data = screenshot_base64

            # Capture screenshot if not provided
            if not image_data:
                if not session.security.enable_screenshots:
                    return "Error: Screenshots disabled by security policy"

                page = await session.ensure_page(tab_id)
                screenshot_timeout = session.security.screenshot_timeout_ms / 1000.0

                try:
                    # Capture screenshot with timeout
                    if selector:
                        element = await asyncio.wait_for(
                            page.query_selector(selector),
                            timeout=screenshot_timeout
                        )
                        if element is None:
                            return f"Error: Selector '{selector}' not found for vision analysis"
                        buffer = await asyncio.wait_for(
                            element.screenshot(),
                            timeout=screenshot_timeout
                        )
                    else:
                        buffer = await asyncio.wait_for(
                            page.screenshot(full_page=full_page),
                            timeout=screenshot_timeout
                        )

                    image_data = base64.b64encode(buffer).decode("utf-8")

                    # Try to record screenshot, continue even if size limit exceeded
                    try:
                        await session.record_screenshot(
                            image_data,
                            {
                                "action": "vision_capture",
                                "selector": selector,
                                "full_page": full_page,
                            },
                        )
                    except ValueError as size_error:
                        logger.warning(
                            "[%s] Screenshot for vision analysis not stored: %s",
                            session_id,
                            str(size_error),
                        )

                except asyncio.TimeoutError:
                    error_msg = f"Screenshot capture timed out after {screenshot_timeout}s"
                    logger.error("[%s] %s", session_id, error_msg)
                    return f"Error: {error_msg}"

            # Perform vision analysis with timeout
            prompt = question or self.default_prompt
            vision_timeout = session.security.vision_analysis_timeout_ms / 1000.0

            try:
                analysis = await asyncio.wait_for(
                    self.openai_service.analyze_image(
                        image_base64=image_data,
                        prompt=prompt,
                    ),
                    timeout=vision_timeout
                )

                if session.security.log_actions:
                    logger.info("[%s] Vision analysis completed successfully", session_id)

                return analysis

            except asyncio.TimeoutError:
                error_msg = f"Vision analysis timed out after {vision_timeout}s"
                logger.error("[%s] %s", session_id, error_msg)
                return f"Error: {error_msg}. The vision API took too long to respond."

            except Exception as exc:
                # Provide detailed error with fallback guidance
                error_msg = f"Vision analysis failed: {type(exc).__name__}: {str(exc)}"
                logger.error("[%s] %s", session_id, error_msg)

                # Check for common API errors and provide helpful messages
                if "rate_limit" in str(exc).lower():
                    return f"Error: OpenAI rate limit exceeded. Please try again later."
                elif "authentication" in str(exc).lower() or "api_key" in str(exc).lower():
                    return f"Error: OpenAI authentication failed. Check API key configuration."
                elif "model" in str(exc).lower():
                    return f"Error: OpenAI model error. The vision model may be unavailable."
                else:
                    return f"Error: {error_msg}"

        except ValueError as e:
            # Rate limiting or validation errors
            logger.warning("[%s] Validation error: %s", session_id, str(e))
            return f"Error: {str(e)}"
        except Exception as e:
            error_msg = f"Unexpected error in vision analysis tool: {type(e).__name__}: {str(e)}"
            logger.error("[%s] %s", session_id, error_msg)
            return f"Error: {error_msg}"
