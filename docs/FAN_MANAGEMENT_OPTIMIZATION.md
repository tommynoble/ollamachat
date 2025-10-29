# Fan Management & Performance Optimization

**Status:** Planning Phase  
**Priority:** Medium (Quality of Life)  
**Complexity:** Medium  
**Estimated Time:** 2-3 hours total

---

## Problem

Laptop fans spin up loudly during streaming responses due to:
- ❌ Too many React re-renders (hundreds per second)
- ❌ Markdown re-parsing on every frame (expensive)
- ❌ Continuous animations + DOM repaints
- ❌ Development build overhead (2-4x CPU vs production)

---

## Root Causes

### 1. **Re-render Storm**
Every token from stream triggers React re-render → 200+ renders/second

### 2. **Markdown Parsing Overhead**
`react-markdown` re-parses entire message on each render

### 3. **Syntax Highlighting**
Code block highlighting repaints DOM on every update

### 4. **Animation + Rendering**
Typewriter effect + Markdown parsing + CSS transitions = CPU spike

### 5. **Dev Build Penalty**
Vite dev mode has no minification/batching → 2-4x CPU usage

---

## Solutions (Priority Order)

### ✅ Solution 1: Debounce Markdown Updates (QUICK WIN)

**Status:** ⏳ Pending  
**Complexity:** Low  
**Time:** ~15 min  
**Impact:** 🔥🔥🔥 Huge (5x fewer re-renders)

**What to do:**
- Update Markdown only every 200ms instead of every token
- Buffer incoming chunks
- Render 3-5x per second instead of 200x

**Result:** Fans quiet down immediately

---

### ✅ Solution 2: Parse Markdown Only When Done

**Status:** ⏳ Pending  
**Complexity:** Low  
**Time:** ~10 min  
**Impact:** 🔥🔥🔥 Huge (zero CPU while streaming)

**What to do:**
- While streaming: show plain text (whitespace-pre-wrap)
- When done: swap to ReactMarkdown
- No re-parsing during stream

**Result:** Almost zero CPU during generation

---

### ✅ Solution 3: Disable Syntax Highlighting During Stream

**Status:** ⏳ Pending  
**Complexity:** Low  
**Time:** ~5 min  
**Impact:** 🔥🔥 Significant

**What to do:**
- Remove syntax highlighting plugins while streaming
- Re-enable when complete
- Highlight only finished messages

**Result:** Reduced DOM repaints

---

### ✅ Solution 4: Memoize Message Components

**Status:** ⏳ Pending  
**Complexity:** Low  
**Time:** ~10 min  
**Impact:** 🔥🔥 Significant

**What to do:**
- Wrap message bubbles in `React.memo()`
- Prevent re-render of old messages
- Only new/current message updates

**Result:** Prevents re-render cascade

---

### ✅ Solution 5: Disable Animations During Streaming

**Status:** ⏳ Pending  
**Complexity:** Low  
**Time:** ~5 min  
**Impact:** 🔥 Moderate

**What to do:**
- Turn off typewriter animation during long responses
- Use simple fade instead
- Re-enable for user messages

**Result:** Reduced GPU+CPU heat

---

### ✅ Solution 6: Test with Production Build

**Status:** ⏳ Pending  
**Complexity:** Very Low  
**Time:** ~2 min  
**Impact:** 🔥🔥 Significant (baseline check)

**What to do:**
```bash
npm run build && npm run preview
```

**Result:** See actual performance (2-4x better than dev)

---

### 🔧 Solution 7: Advanced Optimizations (Optional)

**Status:** ⏳ Pending  
**Complexity:** High  
**Time:** ~1-2 hours  
**Impact:** 🔥🔥🔥 Extreme (if needed)

**Options:**
- Use `react-markdown-lite` or `micromark` (faster parsers)
- Pre-parse Markdown in Web Worker
- Use virtualized list (react-window) for large chat history
- Stream HTML instead of Markdown

**When to use:** Only if fans still loud after Solutions 1-6

---

## Implementation Checklist

### Phase 1: Quick Wins (30 min)
- [ ] Solution 1: Debounce updates (200ms)
- [ ] Solution 2: Parse only when done
- [ ] Solution 6: Test with production build

### Phase 2: Component Optimization (25 min)
- [ ] Solution 3: Disable syntax highlighting during stream
- [ ] Solution 4: Memoize message components
- [ ] Solution 5: Disable animations during streaming

### Phase 3: Advanced (Optional, 1-2 hours)
- [ ] Solution 7: Advanced optimizations if needed

---

## Monitoring Performance

### Activity Monitor Check:
1. Open Activity Monitor (Cmd+Space → "Activity Monitor")
2. Go to CPU tab
3. Watch during streaming:
   - **Before:** 150-300% CPU (fans loud)
   - **After Solution 1:** 50-100% CPU (fans quiet)
   - **After Solution 6:** 20-40% CPU (fans silent)

### Key Metrics:
| Metric | Before | After Phase 1 | After Phase 2 |
|--------|--------|---------------|---------------|
| CPU Usage | 200-300% | 50-100% | 20-40% |
| Re-renders/sec | 200+ | 5 | 2-3 |
| Fan Speed | 🔴 Loud | 🟡 Moderate | 🟢 Quiet |

---

## Code Changes Preview

### Solution 1: Debounce Example
```javascript
const [renderText, setRenderText] = useState('');
const buffer = useRef('');

useEffect(() => {
  let timer: NodeJS.Timeout;
  const onChunk = (chunk: string) => {
    buffer.current += chunk;
    clearTimeout(timer);
    // Only update 3-5× per second
    timer = setTimeout(() => setRenderText(buffer.current), 200);
  };

  ipcRenderer.on('assistant-chunk', (_, c) => onChunk(c));
  return () => {
    clearTimeout(timer);
    ipcRenderer.removeAllListeners('assistant-chunk');
  };
}, []);
```

### Solution 2: Conditional Rendering Example
```javascript
{isStreaming
  ? <pre className="whitespace-pre-wrap text-sm">{partialText}</pre>
  : <ReactMarkdown remarkPlugins={[remarkGfm]}>{fullMessage}</ReactMarkdown>}
```

### Solution 4: Memoization Example
```javascript
const MemoizedChatBubble = React.memo(({ message }) => (
  <TypewriterMessage message={message} />
));

// In render:
{messages.map(m => (
  <MemoizedChatBubble key={m.id} message={m} />
))}
```

---

## Testing Workflow

1. **Baseline:** Run current app, note CPU usage
2. **Apply Solution 1:** Debounce, check CPU
3. **Apply Solution 2:** Parse on done, check CPU
4. **Apply Solution 4:** Memoize, check CPU
5. **Test Production:** `npm run preview`, compare

---

## Expected Results

### After Phase 1 (Quick Wins):
- ✅ Fans noticeably quieter
- ✅ CPU drops from 200-300% to 50-100%
- ✅ Smooth streaming still works
- ✅ No visible lag

### After Phase 2 (Full Optimization):
- ✅ Fans almost silent
- ✅ CPU drops to 20-40%
- ✅ Excellent user experience
- ✅ Laptop stays cool

### After Phase 3 (Advanced, if needed):
- ✅ Fans completely silent
- ✅ CPU < 20%
- ✅ Production-grade performance

---

## Rollback Plan

If performance issues arise:
1. Revert to commit before Phase 1
2. Apply solutions one at a time
3. Test after each change

---

## Notes

- **Dev vs Prod:** Dev build is 2-4x slower. Always test with `npm run preview`
- **Debouncing sweet spot:** 100-300ms (we'll use 200ms)
- **Memoization:** Critical for large chat histories
- **Syntax highlighting:** Can wait until message is complete

---

## Questions Before Starting?

- Should we implement all 3 phases or just Phase 1?
- Do you want to test production build first?
- Any specific CPU threshold you want to hit?

---

**Ready to implement?** Start with Phase 1 for quick wins! 🚀
