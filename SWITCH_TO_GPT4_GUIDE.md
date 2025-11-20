# Guide: Switching from GPT-4o to GPT-4

## Current Model Configuration

### ✅ Currently Using: **GPT-4o** (GPT-4 Optimized)

**Model Locations:**
1. **Default Model**: `gpt-4o` (in `ai_service/config.py`)
2. **Fallback Model**: `gpt-3.5-turbo` (in `ai_service/config.py`)
3. **Hardcoded References**: Multiple files use `gpt-4o` directly

**Files Using GPT-4o:**
- `ai_service/config.py` - Default model configuration
- `ai_service/openai_service.py` - All OpenAI API calls
- `backend/routes/ai.js` - Backend chat endpoint
- `ai_service/hybrid_ai_architecture.py` - Model selection logic

---

## Important Note: GPT-4o vs GPT-4

**GPT-4o** (currently used):
- ✅ Newer model (released May 2024)
- ✅ Faster and cheaper than GPT-4
- ✅ Better performance than GPT-4
- ✅ Multimodal capabilities

**GPT-4** (older):
- ⚠️ Older model (released March 2023)
- ⚠️ Slower and more expensive
- ⚠️ Less capable than GPT-4o

**GPT-4 Turbo** (alternative):
- ✅ Faster than GPT-4
- ✅ Better than GPT-4, but GPT-4o is still better
- ✅ Good middle ground if you want GPT-4 family

**Recommendation**: GPT-4o is actually better than GPT-4. Consider if you really want to switch.

---

## Steps to Switch to GPT-4

### Option 1: Switch to GPT-4 Turbo (Recommended if switching from GPT-4o)

**Model Name**: `gpt-4-turbo` or `gpt-4-turbo-preview`

#### Step 1: Update Environment Variables

Create or update `.env` file in project root:

```bash
# In .env or .env.local
DEFAULT_AI_MODEL=gpt-4-turbo
FALLBACK_AI_MODEL=gpt-3.5-turbo
```

#### Step 2: Update Config File

**File**: `ai_service/config.py`

```python
# Line 21 - Change default model
DEFAULT_MODEL = os.getenv("DEFAULT_AI_MODEL", "gpt-4-turbo")  # Changed from "gpt-4o"
```

#### Step 3: Update Hardcoded References

**File**: `ai_service/openai_service.py`

Replace all instances of `"gpt-4o"` with `"gpt-4-turbo"`:

```python
# Line 38 - analyze_document_content
model="gpt-4-turbo",  # Changed from "gpt-4o"

# Line 75 - extract_structured_data
model="gpt-4-turbo",  # Changed from "gpt-4o"

# Line 125 - analyze_image (if exists)
model="gpt-4-turbo",  # Changed from "gpt-4o"

# Line 220 - Other methods
model="gpt-4-turbo",  # Changed from "gpt-4o"
```

**File**: `backend/routes/ai.js`

```javascript
// Line 950 - Update model
model: "gpt-4-turbo",  // Changed from "gpt-4o"
```

#### Step 4: Update Hybrid AI Architecture (if needed)

**File**: `ai_service/hybrid_ai_architecture.py`

If you want GPT-4 Turbo in the model selection:

```python
# Line 205-211 - Update model config
"gpt-4-turbo": ModelConfig(
    name="gpt-4-turbo",
    provider=ModelProvider.OPENAI,
    # ... rest of config
)
```

---

### Option 2: Switch to GPT-4 (Original)

**Model Name**: `gpt-4`

**Note**: GPT-4 is slower and more expensive than GPT-4o. Not recommended unless you have specific requirements.

Follow same steps as Option 1, but use `"gpt-4"` instead of `"gpt-4-turbo"`.

---

## Quick Switch Script

I can create a script to automatically update all references. Would you like me to:

1. **Update all files automatically** to use GPT-4 Turbo?
2. **Update all files** to use GPT-4 (original)?
3. **Show you the exact changes** before making them?

---

## Verification Steps

After making changes:

1. **Restart AI Service**:
   ```bash
   cd ai-service
   python3 app.py
   ```

2. **Restart Backend**:
   ```bash
   cd backend
   npm run dev
   ```

3. **Test Model Usage**:
   - Make a test API call
   - Check logs for model name
   - Verify response quality

4. **Check Costs**:
   - GPT-4 Turbo: ~$0.01/1K input tokens, $0.03/1K output tokens
   - GPT-4: ~$0.03/1K input tokens, $0.06/1K output tokens
   - GPT-4o: ~$0.005/1K input tokens, $0.015/1K output tokens (cheapest!)

---

## Model Comparison

| Model | Speed | Cost | Capability | Release |
|-------|-------|------|------------|---------|
| GPT-4o | ⚡⚡⚡ Fast | 💰💰 Cheap | ⭐⭐⭐ Best | May 2024 |
| GPT-4 Turbo | ⚡⚡ Medium | 💰💰💰 Medium | ⭐⭐ Good | Nov 2023 |
| GPT-4 | ⚡ Slow | 💰💰💰💰 Expensive | ⭐⭐ Good | Mar 2023 |
| GPT-3.5 Turbo | ⚡⚡⚡ Fastest | 💰 Cheapest | ⭐ Basic | Nov 2022 |

---

## Recommendation

**Keep GPT-4o** unless you have specific reasons to switch:
- ✅ Best performance
- ✅ Lowest cost
- ✅ Fastest responses
- ✅ Multimodal support

**Switch to GPT-4 Turbo** if:
- You need GPT-4 family specifically
- You want better than GPT-4 but don't need GPT-4o features

**Switch to GPT-4** if:
- You have specific compatibility requirements
- You need the original GPT-4 model

---

## Next Steps

Tell me which option you prefer:
1. **Keep GPT-4o** (recommended)
2. **Switch to GPT-4 Turbo** (I'll update all files)
3. **Switch to GPT-4** (I'll update all files)
4. **Show me the changes first** (before making them)

