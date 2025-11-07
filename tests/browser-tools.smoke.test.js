const axios = require('axios');

const baseUrl = process.env.BROWSER_TOOL_URL;

if (!baseUrl) {
  console.warn('⚠️ Skipping browser tool smoke tests because BROWSER_TOOL_URL is not set.');
}

const describeOrSkip = baseUrl ? describe : describe.skip;

describeOrSkip('Browser tool smoke test', () => {
  const client = axios.create({ baseURL: baseUrl, timeout: 20000 });
  const sessionId = `smoke-${Date.now()}`;
  const fixtureUrl = process.env.BROWSER_TOOL_FIXTURE_URL || 'https://example.com';

  afterAll(async () => {
    try {
      await client.delete(`/sessions/${sessionId}`);
    } catch (error) {
      // Session cleanup is best-effort; log for visibility but do not fail the suite.
      console.warn('⚠️ Unable to delete browser session during cleanup:', error.message);
    }
  });

  test('navigates to fixture page and captures a screenshot', async () => {
    const health = await client.get('/health');
    expect(health.status).toBe(200);
    expect(health.data).toHaveProperty('status');

    const navigateResponse = await client.post(`/sessions/${sessionId}/navigate`, {
      url: fixtureUrl,
      waitFor: 'body'
    });

    expect(navigateResponse.status).toBe(200);
    expect(navigateResponse.data).toHaveProperty('status');

    const screenshotResponse = await client.post(`/sessions/${sessionId}/screenshot`, {
      fullPage: false
    });

    expect(screenshotResponse.status).toBe(200);
    expect(typeof screenshotResponse.data?.screenshot).toBe('string');
    expect(screenshotResponse.data.screenshot.length).toBeGreaterThan(100);
    const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    expect(base64Pattern.test(screenshotResponse.data.screenshot)).toBe(true);
  });
});
