# Browser Automation Operations Runbook

This runbook documents how to operate the browser-enabled workflow that powers the navigation, screenshot, and extraction tooling. Use it when onboarding new environments or responding to incidents affecting automated browser work.

## 1. Feature Flag & Environment Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENABLE_BROWSER_AUTOMATION` | `1` | Global feature flag for Python agents. Set to `0`, `false`, or `off` to disable browser tooling entirely. |
| `BROWSER_ALLOWED_DOMAINS` | `localhost:3000,localhost:3001,127.0.0.1:3000,127.0.0.1:3001` | Restricts navigation targets for the Playwright session manager. |
| `BROWSER_TOOL_URL` | _(none)_ | Base URL for the standalone browser-tool service used by smoke tests and manual verification. |
| `BROWSER_TOOL_FIXTURE_URL` | `https://example.com` | Fixture page used by the smoke test to validate navigation and screenshot capture. |

When `ENABLE_BROWSER_AUTOMATION` is disabled, the AI service logs a warning and skips initializing Playwright sessions. The orchestrator still boots, but agents fall back to non-browser workflows.

## 2. Starting the Browser Tool Service

1. Ensure Playwright (and required browsers) are installed in the runtime where the service will run.
2. Launch the browser-tool service. The reference implementation exposes:
   - `GET /health` — returns `{ status: 'ok' }` when healthy.
   - `POST /sessions/:id/navigate` — navigates the named session to a URL.
   - `POST /sessions/:id/screenshot` — captures a base64 encoded PNG from the current page.
   - `DELETE /sessions/:id` — optional cleanup endpoint.
3. Export `BROWSER_TOOL_URL` to point at the running service before executing smoke tests.

## 3. Validating the Workflow

Run the automated checks whenever the service is rolled out or after maintenance:

```bash
# Python unit tests (panel tool request coverage)
pytest ai-service/tests/test_panel_manipulation_tool.py

# Browser smoke test (requires BROWSER_TOOL_URL)
BROWSER_TOOL_URL=http://localhost:8123 \
BROWSER_TOOL_FIXTURE_URL=https://example.com \
npm test -- browser-tools.smoke.test.js
```

Successful runs log clear emoji-tagged events such as `✅` panel moves, `🚚` batch updates, and `🧠` orchestrator executions, which makes tailing logs during validation straightforward.

## 4. Recovery Steps When the Browser Service Is Unavailable

1. **Check health**: `curl $BROWSER_TOOL_URL/health`. If this fails, inspect the service logs for Playwright launch errors.
2. **Recycle sessions**: If health passes but commands fail, delete the impacted session (`DELETE /sessions/:id`) and retry the smoke test.
3. **Restart the service**: Restart the browser-tool process to release stuck Chromium instances.
4. **Disable automation temporarily**: Set `ENABLE_BROWSER_AUTOMATION=0` and restart the AI service to keep panel APIs operational while the browser service is investigated.
5. **Re-run smoke tests**: Once the service is back, rerun the commands in section 3 to confirm navigation and screenshot capture are healthy.

## 5. Observability Tips

- Tail AI service logs for emoji markers (`🚀`, `🧾`, `🏁`) to confirm orchestrated flows reached completion stages.
- The integration smoke test prints cleanup warnings if it cannot delete the session; investigate these to avoid orphaned browser contexts.
- Consider adding structured log shipping from the browser-tool service so that navigation and screenshot events are correlated with orchestrator log lines.
