# 🚀 RESTART CHECKLIST - AZD Validation Fix

**AFTER VS CODE RESTART - START HERE**

---

## 📍 Current Situation

**What We're Fixing:**
- AZD validation parses logs (WRONG) → Should parse artifact (CORRECT)
- False failures from unrelated workflow errors
- Can't show warnings vs failures

**Why It Matters:**
- This is THE core feature for demo TODAY
- Wastes GitHub Actions minutes with false failures
- Customer pain point we're solving

**Status:**
- ✅ Complete implementation plan documented
- ✅ Architecture understood (Express, not Azure Functions)
- ⏸️ Ready to implement after terminal restart

---

## 🎯 What's Been Done (Don't Re-Do)

✅ **Architecture Analysis:**
- Read AGENTS.md
- Confirmed Express migration (20/20 endpoints)
- Understood artifact-based validation flow

✅ **Documentation Created:**
- `docs/development/AZD_VALIDATION_ARTIFACT_PARSING.md` (FULL PLAN)
- `docs/development/QUICK_START_AZD_VALIDATION_FIX.md` (QUICK REF)
- Updated `AGENTS.md` with reference

✅ **Plan Reviewed:**
- Three-state logic designed (success/warning/failure)
- Four phases mapped out
- Timeline: 3.5-4.5 hours
- Testing strategy defined

---

## ▶️ Next Steps (After Restart)

### 1. Verify Environment (2 min)

```bash
# Open terminal in VS Code
# Check Node.js available
/usr/local/bin/node --version
/usr/local/bin/npm --version

# Should see v18+ and corresponding npm version
```

### 2. Start Implementation (3-4 hours)

**Follow this order:**

1. **Phase 1: Backend (1-2 hours)**
   - File: `packages/server/src/routes/validation.ts`
   - Install: `adm-zip` package
   - Add: `downloadValidationArtifact()` function
   - Add: `parseAzdValidationResult()` function
   - Integrate into validation-status endpoint
   - **📖 See:** `AZD_VALIDATION_ARTIFACT_PARSING.md` Phase 1

2. **Phase 2: Frontend (1 hour)**
   - File: `packages/app/src/scripts/azd-validation.ts`
   - Remove: `parseAzdResults()` (lines 27-68)
   - Add: `displayAzdValidationResults()` function
   - Update: `pollValidationStatus()` logic
   - **📖 See:** `AZD_VALIDATION_ARTIFACT_PARSING.md` Phase 2

3. **Phase 3: Schema (30 min)**
   - File: `schemas/results.schema.json`
   - Add: `azdValidation` object
   - **📖 See:** `AZD_VALIDATION_ARTIFACT_PARSING.md` Phase 3

4. **Phase 4: Badges (1 hour)**
   - File: Template tile rendering code
   - Add: Validation status badges
   - **📖 See:** `AZD_VALIDATION_ARTIFACT_PARSING.md` Phase 4

### 3. Test (1 hour)

```bash
# Build Docker
docker-compose up --build

# Access at http://localhost:3000
# Trigger validation
# Verify three states work
```

---

## 📚 Documentation Files

**Primary Reference (READ THIS FIRST):**
```
docs/development/AZD_VALIDATION_ARTIFACT_PARSING.md
```
- Complete implementation plan
- Full code samples for all phases
- Testing strategy
- Success criteria
- 50+ pages of detailed guidance

**Quick Reference:**
```
docs/development/QUICK_START_AZD_VALIDATION_FIX.md
```
- One-page summary
- Quick steps
- Key decision points

**Architecture Reference:**
```
AGENTS.md
```
- Project overview
- Express architecture (NOT Azure Functions)
- Port configuration (3000 for OAuth)

---

## 🎨 Three-State Logic (Remember This)

```
IF azd up ✓ AND azd down ✓:
  IF no PSRule errors:
    IF no PSRule warnings:
      STATUS = SUCCESS (✅ green)
    ELSE:
      STATUS = WARNING (⚠️ yellow)
  ELSE:
    STATUS = FAILURE (❌ red)
ELSE:
  STATUS = FAILURE (❌ red)
```

---

## ⚠️ Common Pitfalls to Avoid

❌ **Don't** parse workflow logs (old approach)  
✅ **Do** parse resultFile artifact (new approach)

❌ **Don't** look at Azure Functions code  
✅ **Do** use Express routes in `packages/server/`

❌ **Don't** use different ports for frontend/backend  
✅ **Do** run both on port 3000 (OAuth requirement)

❌ **Don't** create mocks or stubs  
✅ **Do** implement full production-ready code

---

## 🔍 File Locations (Quick Reference)

```
Backend:
  packages/server/src/routes/validation.ts  ← Add artifact download/parsing

Frontend:
  packages/app/src/scripts/azd-validation.ts  ← Remove log parsing, add artifact display

Schema:
  schemas/results.schema.json  ← Add azdValidation object

Workflow:
  .github/workflows/validation-template.yml  ← Uses microsoft/template-validation-action

Docs:
  docs/development/AZD_VALIDATION_ARTIFACT_PARSING.md  ← FULL IMPLEMENTATION PLAN
  docs/development/QUICK_START_AZD_VALIDATION_FIX.md  ← QUICK REFERENCE
  AGENTS.md  ← Architecture overview
```

---

## ✅ Success Criteria (Demo Readiness)

Before declaring done:

- [ ] Install adm-zip successfully
- [ ] Backend downloads and parses artifact
- [ ] Frontend displays three states correctly
- [ ] Success shows green ✅ (azd up/down both pass, no warnings)
- [ ] Warning shows yellow ⚠️ (azd up/down pass, has warnings)
- [ ] Failure shows red ❌ (azd up/down fails OR PSRule errors)
- [ ] Execution times display (e.g., "45.2s")
- [ ] PSRule counts accurate
- [ ] GitHub run link works
- [ ] Docker build succeeds
- [ ] Manual test with demo template passes
- [ ] No console errors

---

## 🆘 If You Get Stuck

1. **Read the full plan first:**
   ```
   docs/development/AZD_VALIDATION_ARTIFACT_PARSING.md
   ```

2. **Check architecture reference:**
   ```
   AGENTS.md
   ```

3. **Verify you're in the right files:**
   - Express backend: `packages/server/`
   - NOT Azure Functions: `packages/api/` (legacy branch)

4. **Remember the three states:**
   - Success (green): AZD works, no warnings
   - Warning (yellow): AZD works, has warnings
   - Failure (red): AZD fails OR PSRule errors

---

## 🎬 Ready to Start?

1. **Restart VS Code** (to fix terminal)
2. **Open this file** (`RESTART_CHECKLIST.md`)
3. **Verify Node.js** works (`/usr/local/bin/node --version`)
4. **Open implementation plan** (`AZD_VALIDATION_ARTIFACT_PARSING.md`)
5. **Start Phase 1** (Backend - install adm-zip)

---

**Timeline:** 3.5-4.5 hours + 1 hour testing = ~5 hours total  
**Demo:** TODAY - plenty of time if started now  
**Confidence:** HIGH - plan is complete, architecture understood  

**LET'S BUILD THIS! 🚀**
