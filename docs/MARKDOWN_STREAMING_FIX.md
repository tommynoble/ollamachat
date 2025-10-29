# Markdown Streaming Fix - Implementation Plan

**Status:** Ready to implement  
**Complexity:** Medium  
**Time:** ~45 min  
**Priority:** High (fixes broken formatting)

---

## Problem

Currently:
- ❌ Typewriter effect on EVERY character breaks Markdown (shows `**Cri` instead of **Cricket**)
- ❌ Using `whitespace-pre-wrap` (raw text, no formatting)
- ❌ No Markdown parser installed
- ❌ Lists/headings render as plain text
- ❌ Code blocks don't syntax highlight

Result: Responses look broken while streaming.

---

## Solution Overview

1. **Install Markdown renderer** - `react-markdown` + `remark-gfm`
2. **Buffer chunks safely** - Debounce rendering (don't typewriter every char)
3. **Keep typewriter for user only** - Assistant uses smooth chunk rendering
4. **Auto-close code fences** - Prevent dangling ``` from breaking layout
5. **Update system prompt** - Tell model to use Markdown formatting
6. **Add CSS styling** - Match your screenshot with prose styles

---

## Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
npm i react-markdown remark-gfm
```

**Status:** ⏳ Pending  
**Time:** ~2 min

---

### Step 2: Create Markdown Renderer Component

**File:** `/src/components/ChatWindow.tsx`

Replace the `TypewriterMessage` component with:
- Keep typewriter for **user messages** (instant display)
- Use **buffered streaming** for assistant messages (debounced rendering)
- Add Markdown rendering with custom components

**Status:** ⏳ Pending  
**Time:** ~15 min

Key changes:
- User messages: instant display (no typewriter)
- Assistant messages: buffer chunks, render on newline or 100ms debounce
- Use `ReactMarkdown` with `remark-gfm`
- Custom styling for headings, lists, code blocks

---

### Step 3: Add Helper Functions

**File:** `/src/components/ChatWindow.tsx`

Add:
- `closeDanglingFence()` - Auto-close unclosed code blocks
- `debounceRender()` - Render only on safe boundaries

**Status:** ⏳ Pending  
**Time:** ~10 min

---

### Step 4: Update System Prompt

**File:** `/main.js` (lines 418-423)

Add Markdown formatting rules:
```
FORMAT RULES:
- Always answer in GitHub-flavored Markdown.
- Use numbered section headings (## 1., ## 2., …).
- For each item, use **bold** labels followed by clear text.
- Use bullet lists where helpful. No HTML.
```

**Status:** ⏳ Pending  
**Time:** ~5 min

---

### Step 5: Add Tailwind CSS Classes

**File:** `tailwind.config.js`

Ensure `@tailwindcss/typography` is installed:
```bash
npm i -D @tailwindcss/typography
```

Update config:
```javascript
plugins: [require('@tailwindcss/typography')]
```

**Status:** ⏳ Pending  
**Time:** ~5 min

---

### Step 6: Test & Validate

**Status:** ⏳ Pending  
**Time:** ~15 min

Test cases:
- [ ] User messages display instantly (no typewriter)
- [ ] Assistant messages stream smoothly
- [ ] Markdown renders correctly (headings, lists, bold, code)
- [ ] Code blocks don't break layout
- [ ] Dangling ``` auto-closes
- [ ] Emoji/multi-byte chars work
- [ ] All models work (llama2, deepseek-r1)

---

## Current State vs. Target

| Aspect | Current | Target |
|--------|---------|--------|
| User messages | Typewriter | Instant ✅ |
| Assistant messages | Typewriter (breaks Markdown) | Buffered chunks ✅ |
| Rendering | Raw text | Markdown + syntax highlighting ✅ |
| Lists | Plain text | Formatted bullets ✅ |
| Code blocks | Plain text | Syntax highlighted ✅ |
| Headings | Plain text | Styled h2/h3 ✅ |
| Performance | Character-by-character | Chunk-based ✅ |

---

## Code Diff Preview

### Before:
```jsx
<div className="text-base whitespace-pre-wrap leading-8 space-y-4">
  {displayedContent}  {/* Raw text, typewriter effect */}
</div>
```

### After:
```jsx
<div className="prose prose-invert max-w-2xl">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {closeDanglingFence(renderText)}  {/* Markdown, buffered rendering */}
  </ReactMarkdown>
</div>
```

---

## Why This Works

1. **Buffering** - Prevents rendering half-formed Markdown syntax
2. **Debouncing** - Renders only on newlines or 100ms idle
3. **Markdown parser** - Properly closes tags before rendering
4. **System prompt** - Model knows to format as Markdown
5. **Auto-close fences** - Dangling ``` won't break layout
6. **Prose styling** - Professional typography + spacing

---

## Rollback Plan

If issues arise:
1. Revert to commit before Step 1
2. Keep typewriter for both user + assistant (less pretty but stable)
3. Implement one step at a time

---

## Questions Before Starting?

- Should we keep typewriter for user messages or make them instant too?
- Do you want syntax highlighting for code blocks?
- Should we add a "copy code" button for code blocks?
- Any specific Markdown features to prioritize?

---

**Ready to start Step 1?** 🚀
