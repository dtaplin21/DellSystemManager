# Branch Protection Setup Guide

This guide explains how to set up branch protection rules for the repository to ensure code quality and prevent accidental merges.

## Overview

Branch protection rules enforce that:
- ✅ E2E tests must pass before merging
- ✅ Code reviews are required
- ✅ Force pushes are prevented
- ✅ Branches are kept up to date

## Manual Setup (GitHub UI)

### Step 1: Navigate to Branch Protection Settings

1. Go to: `https://github.com/dtaplin21/DellSystemManager/settings/branches`
2. Click "Add rule" or edit existing rule for `main` branch

### Step 2: Configure Protection Rules

**Branch name pattern**: `main`

**Required Settings:**

1. ✅ **Require a pull request before merging**
   - Required approvals: `1`
   - Dismiss stale pull request approvals when new commits are pushed: ✅
   - Require review from Code Owners: ⚠️ (if CODEOWNERS file exists)

2. ✅ **Require status checks to pass before merging**
   - Required status checks:
     - `E2E Tests` (from GitHub Actions)
   - Require branches to be up to date before merging: ✅

3. ✅ **Require conversation resolution before merging**: ✅

4. ✅ **Require linear history**: ⚠️ (Optional, but recommended)

5. ✅ **Include administrators**: ⚠️ (Optional - allows admins to bypass)

6. ✅ **Restrict who can push to matching branches**
   - Allow specified actors: (Leave empty to restrict to PRs only)

7. ✅ **Do not allow bypassing the above settings**: ✅

8. ✅ **Allow force pushes**: ❌ (Unchecked)

9. ✅ **Allow deletions**: ❌ (Unchecked)

### Step 3: Configure Protection for `develop` Branch

Repeat Step 2 for the `develop` branch with similar settings:
- Require PR before merging: ✅
- Require status checks: ✅
- Require E2E Tests to pass: ✅

## Automated Setup (GitHub CLI)

If you have GitHub CLI installed, you can use the provided script:

```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Linux: See https://cli.github.com/

# Authenticate
gh auth login

# Run the setup script
./scripts/setup-branch-protection.sh
```

## Verification

After setup, verify protection rules:

1. Create a test PR to `main`
2. Verify that:
   - PR cannot be merged without E2E tests passing
   - PR requires at least 1 approval
   - Force push is blocked

## Troubleshooting

### Tests Not Showing as Required

**Issue**: E2E Tests workflow doesn't appear in required status checks.

**Solution**:
1. Ensure workflow file is in `.github/workflows/e2e-tests.yml`
2. Run the workflow at least once manually
3. Check that workflow name matches exactly: `E2E Tests`
4. Refresh the branch protection settings page

### Cannot Push to Protected Branch

**Issue**: Direct pushes to `main` are blocked.

**Solution**: This is expected behavior. Use pull requests instead:
1. Create a feature branch
2. Push changes to feature branch
3. Create PR to `main`
4. Wait for tests to pass
5. Get approval
6. Merge PR

### Bypassing Protection (Emergency Only)

If you need to bypass protection in an emergency:

1. Go to branch protection settings
2. Temporarily disable protection
3. Make emergency fix
4. Re-enable protection immediately
5. Document the bypass in an issue

**Note**: Only use this for true emergencies. Always re-enable protection immediately.

## Best Practices

1. **Always use PRs**: Never push directly to `main` or `develop`
2. **Keep branches updated**: Rebase feature branches before merging
3. **Review carefully**: Don't approve PRs without reviewing code
4. **Test locally**: Run tests before pushing to avoid CI failures
5. **Small PRs**: Keep PRs focused and small for easier review

## Related Documentation

- [CI/CD Documentation](../ci-cd/README.md)
- [E2E Testing Guide](../../tests/README.md)
- [Contributing Guidelines](../../CONTRIBUTING.md) (if available)

