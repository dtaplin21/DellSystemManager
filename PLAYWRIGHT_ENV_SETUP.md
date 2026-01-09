## Playwright E2E: local credentials setup

When running Playwright E2E tests against the deployed frontend (`https://dellsystemmanager.vercel.app`), you must provide a valid Supabase test user.

### Recommended: `.env.playwright` (not committed)

Create a file named `.env.playwright` in the repo root:

```env
TEST_USER_EMAIL=playwright-e2e-1767906508@example.com
TEST_USER_PASSWORD=user123
```

Optional override if you want to run against a different frontend URL:

```env
PLAYWRIGHT_TEST_BASE_URL=https://dellsystemmanager.vercel.app
```

### Run tests

```bash
npm run test:e2e
```


