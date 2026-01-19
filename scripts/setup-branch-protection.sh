#!/bin/bash

# Branch Protection Setup Script
# This script sets up branch protection rules using GitHub CLI

set -e

REPO="dtaplin21/DellSystemManager"
MAIN_BRANCH="main"
DEVELOP_BRANCH="develop"

echo "🔒 Setting up branch protection rules for $REPO"
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI."
    echo "Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is installed and authenticated"
echo ""

# Function to set up protection for a branch
setup_protection() {
    local branch=$1
    echo "📋 Setting up protection for '$branch' branch..."
    
    # Create protection rule
    gh api repos/$REPO/branches/$branch/protection \
        --method PUT \
        --field required_status_checks='{"strict":true,"contexts":["E2E Tests"]}' \
        --field enforce_admins=true \
        --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false}' \
        --field restrictions=null \
        --field allow_force_pushes=false \
        --field allow_deletions=false \
        --field required_linear_history=false \
        --field allow_squash_merge=true \
        --field allow_merge_commit=true \
        --field allow_rebase_merge=true \
        --field block_creations=false \
        --field required_conversation_resolution=true || {
        echo "⚠️  Failed to set up protection for $branch. It may already be protected."
        echo "   You can configure it manually at: https://github.com/$REPO/settings/branches"
        return 1
    }
    
    echo "✅ Protection rules set for '$branch' branch"
}

# Set up protection for main branch
setup_protection "$MAIN_BRANCH"

echo ""

# Set up protection for develop branch
setup_protection "$DEVELOP_BRANCH"

echo ""
echo "🎉 Branch protection setup complete!"
echo ""
echo "Verification:"
echo "1. Go to: https://github.com/$REPO/settings/branches"
echo "2. Verify protection rules are configured"
echo "3. Create a test PR to verify protection is working"
echo ""
echo "Note: If you see warnings above, you may need to configure protection manually."

