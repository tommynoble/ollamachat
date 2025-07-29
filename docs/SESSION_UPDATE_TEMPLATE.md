# 📝 SESSION UPDATE TEMPLATE

Use this template to update `NEW_AI_SESSION_PROMPT.md` with current progress:

## 🔄 CURRENT SESSION STATUS

### ✅ COMPLETED THIS SESSION:
- [ ] Task 1: Description
- [ ] Task 2: Description
- [ ] Task 3: Description

### 🎯 UNFINISHED/IN-PROGRESS:
- [ ] Task A: Description (Status: X% complete)
- [ ] Task B: Description (Status: Blocked by Y)
- [ ] Task C: Description (Status: Needs testing)

### 📋 NEXT PRIORITIES (from PROJECT_SCALING_PLAN.md):
- [ ] Priority 1: Description (Phase: X)
- [ ] Priority 2: Description (Phase: X)
- [ ] Priority 3: Description (Phase: X)

### 🚨 CURRENT BLOCKERS/ISSUES:
- Issue 1: Description
- Issue 2: Description

### 💡 SESSION INSIGHTS/DECISIONS:
- Decision 1: Description
- Decision 2: Description
- New approach: Description

---

## 🔧 UPDATE INSTRUCTIONS

**Copy the sections above, fill them out, then update these files:**

1. **Update `docs/AI_SESSION_CONTEXT.md`**:
   - Change "CURRENT TASK" section
   - Update "COMPLETED TASKS" list
   - Add any new "NEXT PRIORITIES"

2. **Update `docs/NEW_AI_SESSION_PROMPT.md`**:
   - Add unfinished tasks to "CURRENT SESSION GOALS"
   - Reference specific scaling plan phase
   - Include any blockers/special context

---

## 📋 QUICK UPDATE SCRIPT

**For docs/NEW_AI_SESSION_PROMPT.md - Replace this section:**

```markdown
### 🎯 CURRENT SESSION GOALS:
Please check `docs/AI_SESSION_CONTEXT.md` → "CURRENT TASK" section for what we're working on.
```

**With this updated version:**

```markdown
### 🎯 CURRENT SESSION GOALS:
**UNFINISHED FROM LAST SESSION:**
- [ ] [Task from above]
- [ ] [Task from above]

**NEXT PRIORITIES (Phase X of PROJECT_SCALING_PLAN.md):**
- [ ] [Priority from above]
- [ ] [Priority from above]

**CURRENT BLOCKERS:**
- [Issue from above]

Please check `docs/AI_SESSION_CONTEXT.md` for full context.
```

---

## 🎯 EXAMPLE USAGE:

**Step 1**: Fill out current status above
**Step 2**: Run updates to both files
**Step 3**: Test with new AI session
**Step 4**: Verify continuity works perfectly

**This ensures every new AI knows exactly where we left off and what to work on next!** 🚀 