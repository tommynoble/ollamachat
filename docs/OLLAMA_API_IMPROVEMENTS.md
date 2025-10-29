# Ollama API Improvements - Based on Official Documentation

## Key Findings from Ollama GitHub

### 1. **Streaming Responses** ✅
From Ollama API docs:
```
"Certain endpoints stream responses as JSON objects. Streaming can be disabled by providing {"stream": false} for these endpoints."
```

**Current Status:** ✅ We're using `stream: true` correctly

---

### 2. **Chat Completion Parameters** 

The official Ollama API supports these parameters:

```javascript
{
  "model": "llama2",
  "messages": [...],
  "stream": true,
  "format": "json",  // NEW: Can specify format
  "options": {
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40,
    // ... other parameters
  },
  "keep_alive": "5m",  // NEW: Controls model memory duration
  "think": true  // NEW: For thinking models (deepseek-r1)
}
```

---

### 3. **New Parameters We Should Add**

#### **`keep_alive` Parameter**
```javascript
"keep_alive": "10m"  // Keep model loaded for 10 minutes
```
**Why:** Prevents model from unloading mid-response. Default is 5m, we should increase to 10m.

#### **`think` Parameter (for deepseek-r1)**
```javascript
"think": true  // Enable thinking mode for reasoning models
```
**Why:** Deepseek-r1 is a thinking model. This parameter enables its reasoning capabilities.

#### **`format` Parameter**
```javascript
"format": "json"  // Force JSON output
```
**Why:** Can help with structured responses and prevent truncation.

---

### 4. **Recommended Changes**

**File:** `/main.js` (lines 483-491)

**Current:**
```javascript
const payload = {
  model: modelToUse,
  messages: messages,
  stream: true,
  options: {
    ...modelConfig,
    num_ctx: 4096,
  },
};
```

**Improved:**
```javascript
const payload = {
  model: modelToUse,
  messages: messages,
  stream: true,
  keep_alive: "10m",  // NEW: Keep model loaded longer
  think: model.toLowerCase().includes('deepseek'),  // NEW: Enable thinking for deepseek
  options: {
    ...modelConfig,
    num_ctx: 4096,
  },
};
```

---

### 5. **Why Official App Works Better**

The official Ollama app likely:
1. ✅ Uses streaming correctly (we do this)
2. ✅ Sets appropriate `keep_alive` (we don't)
3. ✅ Enables `think` for reasoning models (we don't)
4. ✅ Has longer timeouts (we have 5 min)
5. ✅ Handles large responses properly (we might have buffer issues)

---

### 6. **Action Items**

### Priority 1 - Add Missing Parameters
```javascript
// Add to payload in main.js
keep_alive: "10m",
think: model.toLowerCase().includes('deepseek'),
```

### Priority 2 - Increase Timeout Further
```javascript
timeout: 600000,  // 10 minutes instead of 5
```

### Priority 3 - Test with Official Settings
Test if these changes fix the truncation issue.

---

### 7. **References**

- **Ollama GitHub:** https://github.com/ollama/ollama
- **API Documentation:** https://github.com/ollama/ollama/blob/main/docs/api.md
- **Chat Completion Docs:** https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion

---

**Last Updated:** October 29, 2025  
**Status:** Ready to implement improvements
