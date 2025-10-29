# Senior Dev Improvements Roadmap

**Status:** Planning Phase  
**Goal:** Implement enterprise-grade accuracy, reliability, and flexibility  
**Estimated Effort:** 5-6 focused steps

---

## Overview

These improvements add:
- ✅ **Token-aware history trimming** - Never silently overflow context
- ✅ **Accuracy & JSON mode toggles** - Lock sampler for reliability
- ✅ **Universal stream parser** - Handle all response formats
- ✅ **Model capability detection** - Auto-cap settings per model
- ✅ **Safe retry with backoff** - Recover from transient failures
- ✅ **Per-model mutex** - Prevent interleaved streams

---

## Step 1: Add Helper Functions (Top of main.js)

**Status:** ⏳ Pending  
**Complexity:** Low  
**Time:** ~15 min

### What to add:
- `UI_FLAGS` object (Accuracy & JSON mode toggles)
- `roughTokenCount()` - Token estimator (~4 chars/token)
- `fitHistoryByTokens()` - Token-aware history trimming
- `modelCapsCache` - Cache model capabilities
- `httpGetJSON()` - Generic HTTP GET helper
- `getModelCaps()` - Fetch model capabilities from `/api/tags`
- `withModelLock()` - Per-model mutex for stream safety

### Why:
- Prevents context overflow silently
- Enables dynamic capability detection
- Ensures no interleaved streams corrupt buffers

**Next:** Step 2

---

## Step 2: Build Messages with Token Awareness

**Status:** ⏳ Pending  
**Complexity:** Low  
**Time:** ~10 min

### What to add:
- `buildMessages()` function
- Replaces manual history assembly
- Uses `fitHistoryByTokens()` to trim intelligently
- Reserves 60% of context for prompt, 40% for output

### Why:
- Keeps conversation coherent
- Prevents "lost context" truncation
- Respects model's actual context window

**Next:** Step 3

---

## Step 3: Build Payload with Accuracy/JSON Modes + Model Caps

**Status:** ⏳ Pending  
**Complexity:** Medium  
**Time:** ~15 min

### What to add:
- `buildPayload()` function
- Applies `ACCURACY_PRESET` when `UI_FLAGS.accuracyMode = true`
- Applies `JSON_MODE` when `UI_FLAGS.expectJson = true`
- Auto-caps `num_ctx` and `num_predict` based on model capabilities

### Why:
- Accuracy mode: temperature 0.2, seed 42 for reproducibility
- JSON mode: structured output for programmatic use
- Model caps: never ask for more than model supports

**Next:** Step 4

---

## Step 4: Universal Stream Parser + Safe Retry

**Status:** ⏳ Pending  
**Complexity:** Medium  
**Time:** ~20 min

### What to add:
- `chatOnce()` function - Single request with universal parser
  - Handles multiple response key formats (`.message.content`, `.response`, `.delta`, `.content`)
  - Robust line-by-line JSON parsing
  - Proper timeout handling
- `chatWithRetry()` function - One retry with backoff
  - 400-600ms random backoff
  - Slight temperature nudge on retry for stability

### Why:
- Fixes "No response received" by handling all formats
- Recovers from cold starts and transient failures
- Prevents timeout conflicts

**Next:** Step 5

---

## Step 5: Integrate into ipcMain.handle('chat-message')

**Status:** ⏳ Pending  
**Complexity:** High  
**Time:** ~30 min

### What to replace:
- Current history assembly → `buildMessages()`
- Current payload building → `buildPayload()`
- Current HTTP request → `chatWithRetry()`
- Wrap in `withModelLock()` for safety

### Key changes:
```javascript
// OLD: manual history slicing
// NEW: token-aware trimming via buildMessages()

// OLD: fixed payload options
// NEW: dynamic payload via buildPayload() with accuracy/JSON toggles

// OLD: single request attempt
// NEW: chatWithRetry() with backoff

// OLD: no mutex
// NEW: withModelLock() prevents interleaved streams
```

### Why:
- Brings all improvements together
- Single source of truth for chat logic
- Enterprise-grade reliability

**Next:** Step 6

---

## Step 6: UI Toggles (Renderer + IPC)

**Status:** ⏳ Pending  
**Complexity:** Medium  
**Time:** ~20 min

### What to add:
- Accuracy Mode checkbox in UI
- JSON Mode toggle (per-request or global)
- Send toggles to main process via IPC
- Update `UI_FLAGS` in real-time

### Why:
- Users can lock sampler for factual tasks
- Enables structured output workflows
- Full control over response behavior

**Next:** Testing & Validation

---

## Step 7: Testing & Validation

**Status:** ⏳ Pending  
**Complexity:** High  
**Time:** ~45 min

### Test cases:
- [ ] Token trimming doesn't lose important context
- [ ] Accuracy mode produces consistent results (seed 42)
- [ ] JSON mode returns valid JSON
- [ ] Model caps prevent overflow errors
- [ ] Retry recovers from empty responses
- [ ] Mutex prevents interleaved streams
- [ ] All models work (llama2, deepseek-r1, etc.)

### Verification:
- Check console logs for token counts
- Verify history length stays reasonable
- Test with large documents (RAG)
- Test rapid successive requests

**Next:** Documentation & Deployment

---

## Step 8: Documentation & Deployment

**Status:** ⏳ Pending  
**Complexity:** Low  
**Time:** ~15 min

### What to do:
- Update `SETTINGS_AND_OPTIMIZATIONS.md` with new settings
- Document `UI_FLAGS` and how to toggle
- Add troubleshooting section
- Commit all changes
- Deploy to production

---

## Implementation Checklist

### Phase 1: Core Helpers
- [ ] Step 1: Add helper functions
- [ ] Step 2: Build messages with token awareness
- [ ] Step 3: Build payload with toggles

### Phase 2: Request Logic
- [ ] Step 4: Universal parser + retry
- [ ] Step 5: Integrate into ipcMain

### Phase 3: UI & Testing
- [ ] Step 6: Add UI toggles
- [ ] Step 7: Comprehensive testing
- [ ] Step 8: Documentation & deploy

---

## Key Metrics to Track

| Metric | Target | Current |
|--------|--------|---------|
| Context overflow errors | 0 | ? |
| Empty response retries | < 2% | ? |
| Interleaved stream bugs | 0 | ? |
| Accuracy mode consistency | > 95% | ? |
| JSON mode validity | 100% | ? |

---

## Rollback Plan

If issues arise:
1. Revert to commit before Step 1
2. Keep `SETTINGS_AND_OPTIMIZATIONS.md` for reference
3. Implement one step at a time with testing

---

## Questions Before Starting?

- Should we implement all 8 steps or start with Phase 1 only?
- Do you want UI toggles for Accuracy/JSON modes?
- Should we add logging/metrics for monitoring?
- Any specific models to prioritize testing?

---

**Ready to start Step 1?** 🚀
