"""Vision-based analysis of browser screenshots using multimodal models."""

from __future__ import annotations

import asyncio
import base64
import logging
from typing import Optional

from crewai.tools import BaseTool

from .browser_sessions import BrowserSessionManager

logger = logging.getLogger(__name__)


class BrowserVisionAnalysisTool(BaseTool):
    """Analyze browser screenshots with a vision-capable language model."""

    name: str = "browser_vision_analyze"
    description: str = (
        "Capture or reuse screenshots and analyze them with a vision model to "
        "detect UI state, errors, or visual changes."
    )

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
        try:
            if not self.openai_service or not getattr(self.openai_service, 'api_key', None):
                return "Error: Vision analysis unavailable - OpenAI service not configured"

            session = await self.session_manager.get_session(session_id, user_id)
            image_data = screenshot_base64

            if not image_data:
                if not session.security.enable_screenshots:
                    return "Error: Screenshots disabled by security policy"

                page = await session.ensure_page(tab_id)
                if selector:
                    element = await page.query_selector(selector)
                    if element is None:
                        return f"Error: Selector '{selector}' not found for vision analysis"
                    buffer = await element.screenshot()
                else:
                    buffer = await page.screenshot(full_page=full_page)

                image_data = base64.b64encode(buffer).decode("utf-8")
                await session.record_screenshot(
                    image_data,
                    {
                        "action": "vision_capture",
                        "selector": selector,
                        "full_page": full_page,
                    },
                )

            prompt = question or self.default_prompt
            try:
                analysis = await self.openai_service.analyze_image(
                    image_base64=image_data,
                    prompt=prompt,
                )
            except Exception as exc:
                logger.error("[%s] Vision analysis failed: %s", session_id, exc)
                return f"Error analyzing screenshot: {exc}"

            if session.security.log_actions:
                logger.info("[%s] Vision analysis completed", session_id)

            return analysis

        except ValueError as e:
            return f"Error: {str(e)}"
        except Exception as e:
            logger.error("[%s] Unexpected error in vision analysis tool: %s", session_id, e)
            return f"Unexpected error in vision analysis tool: {e}"
