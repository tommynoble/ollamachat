# Ollama Chat - Settings & Optimizations

## Overview
This document contains all the critical settings, optimizations, and configurations that have been applied to the Ollama Chat application to ensure optimal performance and prevent common issues.

---

## 🔧 Backend Settings (main.js)

### Response Handling
**File:** `/main.js` (lines 483-491)

```javascript
const payload = {
  model: modelToUse,
  messages: messages,
  stream: true,  // Enable streaming like official Ollama app
  options: {
    ...modelConfig,
    num_ctx: 4096, // Increase context window for longer responses
  },
};
```

**Why:**
- `stream: true` - Enables streaming responses (prevents truncation)
- `num_ctx: 4096` - Maximum context window for Ollama (allows longer responses)

### HTTP Timeout
**File:** `/main.js` (line 497)

```javascript
timeout: 300000, // 5 minute timeout for long responses
```

**Why:** Long responses need time to generate. 5 minutes prevents premature connection closure.

### Token Limits
**File:** `/main.js` (lines 307-312, 360-367)

```javascript
const baseConfig = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.1,
  num_predict: 8192, // Maximum length for complete responses
};

// Llama2 optimizations
if (modelName.toLowerCase().includes('llama2')) {
  const baseConfig = {
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    num_predict: 8192, // Even longer responses - no truncation
  };
}
```

**Why:**
- `num_predict: 8192` - Maximum tokens per response (doubled from 4096)
- Prevents responses from being cut off mid-sentence

### Conversation History
**File:** `/main.js` (lines 464-466)

```javascript
// Add conversation history (keep last 15 exchanges for better context and thinking)
const recentHistory = history.slice(-30); // 15 user + 15 assistant messages for deeper context
messages.push(...recentHistory);
```

**Why:** More history = better context for chain-of-thought reasoning

### Response Logging
**File:** `/main.js` (lines 536-540, 522-524)

```javascript
// Log response size for debugging
console.log(`✅ Response received: ${assistantMessage.length} characters`);
if (assistantMessage.length < 100) {
  console.warn('⚠️ WARNING: Response seems very short!');
}

// Log if this is the last chunk (done: true)
if (parsed.done) {
  console.log(`✅ Stream complete. Total response: ${fullResponse.length} chars`);
}
```

**Why:** Helps identify truncation issues by showing actual response size

---

## 🎨 Frontend Settings (ChatWindow.tsx)

### User Message Styling
**File:** `/src/components/ChatWindow.tsx` (lines 67-71)

```javascript
className={`px-4 py-2 ${
  message.role === 'user'
    ? 'bg-card text-white rounded-2xl max-w-lg opacity-90'
    : 'max-w-2xl text-foreground rounded-2xl px-6 py-3'
}`}
```

**Settings:**
- User messages: `rounded-2xl` (matches chat box)
- User messages: `opacity-90` (subtle transparency)
- User messages: `bg-card` (matches background)
- User messages: `max-w-lg` (compact width)
- AI messages: `max-w-2xl` (wider for longer text)

### Input Area
**File:** `/src/components/ChatWindow.tsx` (line 318)

```javascript
className="flex-1 px-4 py-2 bg-input border border-border rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-ring"
```

**Settings:**
- `rounded-2xl` - Matches message bubbles
- `px-4 py-2` - Compact padding

### Typewriter Effect Speed
**File:** `/src/components/ChatWindow.tsx` (line 59)

```javascript
}, 15) // Adjust speed here (lower = faster)
```

**Why:** 15ms per character = smooth, readable animation

### Message Spacing
**File:** `/src/components/ChatWindow.tsx` (line 65)

```javascript
<div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${message.role === 'user' ? 'mb-2' : 'mb-4'}`}>
```

**Settings:**
- User messages: `mb-2` (compact spacing)
- AI messages: `mb-4` (more breathing room)

---

## 🧠 System Prompt Settings

**File:** `/main.js` (lines 375-409)

The system prompt includes:
- Deep understanding and critical thinking
- Context awareness
- Clarity and accuracy
- Helpfulness and nuance
- Engagement
- **Chain-of-thought reasoning (internal, not shown)**

**Model-Specific Optimizations:**
- **Deepseek:** Enhanced reasoning, logical analysis
- **Llama2:** Versatile, balanced responses
- **Phi:** Efficient, clear explanations
- **CodeLlama:** Production-ready code

---

## 📊 Performance Tuning

### Temperature Settings
- **Deepseek:** 0.5 (focused, fast)
- **Llama2:** 0.7 (balanced)
- **Phi:** 0.8 (creative)
- **CodeLlama:** 0.3 (precise)

### Top-P (Nucleus Sampling)
- **Deepseek:** 0.8 (narrow sampling)
- **Llama2:** 0.9 (balanced)
- **Phi:** 0.95 (creative)

### Top-K (Top-K Sampling)
- **Deepseek:** 30 (fewer options = faster)
- **Llama2:** 40 (balanced)
- **Phi:** 50 (more vocabulary)

---

## 🐛 Debugging Checklist

### If Responses Are Truncated:
1. ✅ Check console for: `✅ Stream complete. Total response: XXXX chars`
2. ✅ If < 500 chars: Response is genuinely short
3. ✅ If > 2000 chars: Truncation is UI-side, not backend
4. ✅ Verify `num_predict: 8192` is set
5. ✅ Verify `num_ctx: 4096` is set
6. ✅ Check `stream: true` is enabled

### If App Crashes:
1. ✅ Check for missing imports (e.g., `ImageIcon`)
2. ✅ Verify all lucide-react icons are imported
3. ✅ Check console for TypeScript errors

### If Chat Stops Working:
1. ✅ Verify Ollama is running (green dot in Settings)
2. ✅ Check timeout isn't too short (should be 300000ms)
3. ✅ Verify streaming is enabled

---

## 📝 Key Files to Monitor

| File | Purpose | Critical Lines |
|------|---------|-----------------|
| `main.js` | Backend, response handling | 307-312, 360-367, 483-491, 497 |
| `ChatWindow.tsx` | UI, message display | 67-71, 318, 59, 65 |
| `rag_system.py` | Document processing | All |
| `preload.js` | IPC security | All |

---

## 🚀 Deployment Checklist

Before deploying, verify:
- ✅ `num_predict: 8192` in both baseConfig and llama2 config
- ✅ `num_ctx: 4096` in payload options
- ✅ `stream: true` enabled
- ✅ `timeout: 300000` set
- ✅ All imports present (Image, FileText, Send, Paperclip)
- ✅ Message spacing correct (mb-2 for user, mb-4 for AI)
- ✅ Border radius consistent (rounded-2xl)
- ✅ Opacity set for user messages (opacity-90)

---

## 📚 References

- **Ollama API Docs:** https://github.com/ollama/ollama/blob/main/docs/api.md
- **ChromaDB:** https://www.trychroma.com/
- **Framer Motion:** https://www.framer.com/motion/
- **Lucide Icons:** https://lucide.dev/

---

**Last Updated:** October 29, 2025  
**Status:** Production Ready ✅
