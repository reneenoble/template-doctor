# Quick Start: AZD Validation Artifact Parsing Fix

**Date:** 2025-10-08  
**Status:** Ready for Implementation  
**Priority:** CRITICAL - Demo TODAY  
**Branch:** `feat/improve-azd-validation`

---

## 🎯 The Problem

**Current:** AZD validation parses workflow logs (WRONG)  
**Correct:** Should parse resultFile artifact (uploaded markdown)

**Impact:**
- ❌ False failures from unrelated workflow errors
- ❌ Can't distinguish AZD failures from PSRule warnings
- ❌ Wastes GitHub Actions minutes

---

## 📋 Quick Implementation Steps

### 1. Install Dependency (5 min)

```bash
# From project root
cd packages/server
/usr/local/bin/npm install adm-zip
```

### 2. Backend Changes (1-2 hours)

**File:** `packages/server/src/routes/validation.ts`

**Add:** Two helper functions + integration into validation-status endpoint

**See:** Full code in `docs/development/AZD_VALIDATION_ARTIFACT_PARSING.md` (Phase 1)

**Key Functions:**
- `downloadValidationArtifact()` - Downloads artifact ZIP from GitHub
- `parseAzdValidationResult()` - Parses markdown for AZD/PSRule status

### 3. Frontend Changes (1 hour)

**File:** `packages/app/src/scripts/azd-validation.ts`

**Remove:** Lines 27-68 (`parseAzdResults()` function - broken log parsing)

**Add:** `displayAzdValidationResults()` function

**Update:** `pollValidationStatus()` to use artifact data

**See:** Full code in `docs/development/AZD_VALIDATION_ARTIFACT_PARSING.md` (Phase 2)

### 4. Schema Update (30 min)

**File:** `schemas/results.schema.json`

**Add:** `azdValidation` object with fields for Up/Down/PSRule status

**See:** Full schema in `docs/development/AZD_VALIDATION_ARTIFACT_PARSING.md` (Phase 3)

### 5. Test (1 hour)

```bash
# Build and run
docker-compose up --build

# Access at http://localhost:3000
# Trigger validation on demo template
# Verify status shows correctly
```

---

## 🎨 Three-State Logic

```
✅ SUCCESS (Green):
   - azd up ✓ AND azd down ✓ AND no PSRule errors/warnings

⚠️ WARNING (Yellow):
   - azd up ✓ AND azd down ✓ AND (PSRule warnings OR workflow issues)

❌ FAILURE (Red):
   - azd up ✗ OR azd down ✗ OR PSRule errors
```

---

## 📚 Full Documentation

**Complete Implementation Plan:**  
`docs/development/AZD_VALIDATION_ARTIFACT_PARSING.md`

**Contains:**
- Full code samples for all phases
- Testing strategy
- Success criteria
- Rollback plan
- Timeline (3.5-4.5 hours total)

---

## 🚀 After VS Code Restart

1. Open terminal
2. Verify Node.js available: `/usr/local/bin/node --version`
3. Start with Phase 1 (backend)
4. Follow checklist in full implementation plan
5. Test thoroughly before demo

---

## ✅ Success Criteria

- [ ] Validation only fails if `azd up` OR `azd down` fails
- [ ] PSRule warnings show as yellow (warning), not red (failure)
- [ ] Unrelated workflow failures don't affect AZD status
- [ ] Demo template shows accurate status
- [ ] No false failures wasting Actions minutes

---

**Next:** See `AZD_VALIDATION_ARTIFACT_PARSING.md` for complete implementation details
