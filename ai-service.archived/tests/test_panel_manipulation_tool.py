import json
import os
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest

# Ensure the ai-service module directory is importable
SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from hybrid_ai_architecture import PanelManipulationInput, PanelManipulationTool  # noqa: E402


@dataclass
class _RecordedCall:
    method: str
    url: str
    json_payload: Optional[Dict[str, Any]]
    params: Optional[Dict[str, Any]]
    headers: Dict[str, str]
    timeout: Optional[int]


class _DummyResponse:
    def __init__(self, status_code: int = 200, payload: Optional[Dict[str, Any]] = None):
        self.status_code = status_code
        self._payload = payload or {}
        self.ok = 200 <= status_code < 300
        self.text = json.dumps(self._payload)

    def json(self) -> Dict[str, Any]:
        return self._payload


class _DummySession:
    def __init__(self, responses: Optional[List[_DummyResponse]] = None):
        self.responses = responses or []
        self.calls: List[_RecordedCall] = []

    def request(
        self,
        method: str,
        url: str,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None,
    ) -> _DummyResponse:
        response = self.responses.pop(0) if self.responses else _DummyResponse()
        recorded = _RecordedCall(
            method=method,
            url=url,
            json_payload=json,
            params=params,
            headers=headers or {},
            timeout=timeout,
        )
        self.calls.append(recorded)
        return response


@pytest.fixture(autouse=True)
def restore_env():
    original = os.environ.get("DISABLE_DEV_BYPASS")
    yield
    if original is None:
        os.environ.pop("DISABLE_DEV_BYPASS", None)
    else:
        os.environ["DISABLE_DEV_BYPASS"] = original


@contextmanager
def _allow_tool_attribute_assignment():
    original = PanelManipulationTool.__setattr__

    def _patched(self, name, value):
        object.__setattr__(self, name, value)

    PanelManipulationTool.__setattr__ = _patched  # type: ignore[assignment]
    try:
        yield
    finally:
        PanelManipulationTool.__setattr__ = original  # type: ignore[assignment]


def test_move_panel_posts_expected_payload_and_headers():
    session = _DummySession([_DummyResponse(payload={"status": "ok"})])
    with _allow_tool_attribute_assignment():
        tool = PanelManipulationTool(base_url="http://api.example", project_id="proj-123")
        tool.session = session

    input_data = PanelManipulationInput(
        action="move_panel",
        panel_id="panel-7",
        position={"x": 10, "y": 20},
    )

    result = tool._execute(input_data)

    assert result["projectId"] == "proj-123"
    assert result["panelId"] == "panel-7"
    assert session.calls, "No request was recorded"
    call = session.calls[0]
    assert call.method == "POST"
    assert call.url == "http://api.example/api/panel-layout/move-panel"
    assert call.json_payload == {
        "projectId": "proj-123",
        "panelId": "panel-7",
        "newPosition": {"x": 10.0, "y": 20.0},
    }
    assert call.headers["x-dev-bypass"] == "true"
    assert "response" in result and result["response"]["status"] == "ok"


def test_batch_move_requests_correct_operations_and_rotation():
    responses = [_DummyResponse(payload={"status": "queued"})]
    session = _DummySession(responses)
    with _allow_tool_attribute_assignment():
        tool = PanelManipulationTool(base_url="http://api.example", project_id="proj-456")
        tool.session = session

    input_data = PanelManipulationInput(
        action="batch_move",
        moves=[
            {"panelId": "p-1", "newPosition": {"x": 1, "y": 2}},
            {"panel_id": "p-2", "new_position": {"x": "3", "y": "4", "rotation": "90"}},
        ],
    )

    result = tool._execute(input_data)

    call = session.calls[0]
    assert call.url.endswith("/api/panel-layout/batch-operations")
    assert call.json_payload["projectId"] == "proj-456"
    payload_ops = call.json_payload["operations"]
    assert payload_ops[0]["payload"]["newPosition"] == {"x": 1.0, "y": 2.0}
    assert payload_ops[1]["payload"]["newPosition"] == {"x": 3.0, "y": 4.0, "rotation": 90.0}
    assert result["operations"] == payload_ops
    assert result["response"]["status"] == "queued"


def test_get_panels_includes_authorization_and_layout():
    responses = [_DummyResponse(payload={"layout": {"panels": [{"id": "abc"}]}})]
    session = _DummySession(responses)
    with _allow_tool_attribute_assignment():
        tool = PanelManipulationTool(
            base_url="http://api.example",
            default_headers={"X-Trace": "trace-id"},
            auth_token="secret",
        )
        tool.session = session

    input_data = PanelManipulationInput(action="get_panels", project_id="proj-789")

    result = tool._execute(input_data)

    call = session.calls[0]
    assert call.method == "GET"
    assert call.url.endswith("/api/panel-layout/get-layout/proj-789")
    assert call.headers["Authorization"] == "Bearer secret"
    assert call.headers["X-Trace"] == "trace-id"
    assert result["layout"]["panels"][0]["id"] == "abc"
