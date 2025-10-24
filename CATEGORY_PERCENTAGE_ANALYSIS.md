# Category Percentage Calculation - Root Cause Analysis

## Problem Summary

Category cards always show **0%** instead of actual compliance percentages. This affects the Category Breakdown section in the dashboard.

## Root Cause

The frontend `adapt.ts` file **ONLY passes through categories if they already exist** in the API response (`result.compliance.categories`), but **NEVER builds them from the issues/compliant data** when they're missing.

### Current Broken Logic (adapt.ts lines 93):

```typescript
// ❌ PROBLEM: Only passes through if already exists
if (result?.compliance?.categories) {
  adapted.compliance.categories = result.compliance.categories;
}
```

**This means**: If the API doesn't send pre-built categories, the frontend shows no categories → percentages default to 0%.

## Where Categories Should Come From

### Backend Logic (CORRECT - routes/results.ts)

The backend **correctly builds categories** from issues/compliant data:

```typescript
function buildCategoriesFromIssues(issues: any[], compliant: any[]) {
  const categories = {
    repositoryManagement: { enabled: true, issues: [], compliant: [], percentage: 0 },
    functionalRequirements: { enabled: true, issues: [], compliant: [], percentage: 0 },
    deployment: { enabled: true, issues: [], compliant: [], percentage: 0 },
    security: { enabled: true, issues: [], compliant: [], percentage: 0 },
    testing: { enabled: true, issues: [], compliant: [], percentage: 0 },
    agents: { enabled: true, issues: [], compliant: [], percentage: 0 },
  };

  // Maps issues to categories (repositoryManagement, deployment, etc.)
  // Calculates: percentage = (compliant / (compliant + issues)) * 100
  
  return categories;
}
```

**Backend uses this in**: `/api/v4/results/:owner/:repo` endpoint (lines 193-198)

### Frontend Rendering (CORRECT - dashboard-renderer.ts)

The frontend **correctly renders categories** if they exist:

```typescript
renderCategoryBreakdown(categories: any) {
  // Line 521: Calculates percentage correctly
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
  
  // Displays: percentage, passed count, issues count
}
```

**Called from**: `render()` method line 358:
```typescript
if (data.compliance?.categories) {
  const categorySection = this.renderCategoryBreakdown(data.compliance.categories);
}
```

## Data Flow Analysis

### Current Flow (BROKEN):

1. **API Response** → May or may not include `compliance.categories`
2. **adapt.ts** → Only passes through if exists, never builds
3. **dashboard-renderer.ts** → Checks `if (data.compliance?.categories)` 
4. **Result**: Categories missing → section not rendered OR shows 0%

### What's Missing:

The frontend `adapt.ts` needs to **build categories from issues/compliant** when they're not provided by the API, **matching the backend logic**.

## Evidence from Console Logs

Looking at dashboard-renderer.ts lines 511-512:

```typescript
console.log('[CategoryBreakdown] Categories data:', categories);
```

And line 513:

```typescript
console.log(`[CategoryBreakdown] ${cat.key}:`, catData);
if (!catData) {
  console.warn(`[CategoryBreakdown] No data for ${cat.key}`);
  return;
}
```

**These logs would show**: Categories object is either:
- Missing entirely (undefined)
- Empty object `{}`
- Has categories but with empty arrays `{ repositoryManagement: { issues: [], passed: [] } }`

## Solution Design

### Option 1: Frontend Builds Categories (RECOMMENDED)

**File**: `packages/app/src/dashboard/adapt.ts`

Add a `buildCategories()` function that mirrors the backend logic:

```typescript
function buildCategoriesFromData(issues: AdaptedIssue[], compliant: AdaptedCompliant[]) {
  const categoryMap: Record<string, string> = {
    file: 'repositoryManagement',
    folder: 'repositoryManagement',
    missing: 'repositoryManagement',
    required: 'repositoryManagement',
    readme: 'functionalRequirements',
    documentation: 'functionalRequirements',
    workflow: 'deployment',
    infra: 'deployment',
    bicep: 'deployment',
    azure: 'deployment',
    security: 'security',
    testing: 'testing',
    agents: 'agents',
  };

  const categories: Record<string, { enabled: boolean; issues: any[]; passed: any[]; percentage: number }> = {
    repositoryManagement: { enabled: true, issues: [], passed: [], percentage: 0 },
    functionalRequirements: { enabled: true, issues: [], passed: [], percentage: 0 },
    deployment: { enabled: true, issues: [], passed: [], percentage: 0 },
    security: { enabled: true, issues: [], passed: [], percentage: 0 },
    testing: { enabled: true, issues: [], passed: [], percentage: 0 },
    agents: { enabled: true, issues: [], passed: [], percentage: 0 },
  };

  // Distribute issues to categories
  issues.forEach((issue) => {
    const cat = issue.category || 'general';
    const mappedCat = categoryMap[cat] || 'repositoryManagement';
    if (categories[mappedCat]) {
      categories[mappedCat].issues.push(issue);
    }
  });

  // Distribute compliant items to categories
  compliant.forEach((item) => {
    const cat = item.category || 'general';
    const mappedCat = categoryMap[cat] || 'repositoryManagement';
    if (mappedCat !== 'meta' && categories[mappedCat]) {
      categories[mappedCat].passed.push(item);
    }
  });

  // Calculate percentages
  Object.keys(categories).forEach((key) => {
    const cat = categories[key];
    const total = cat.issues.length + cat.passed.length;
    cat.percentage = total > 0 ? Math.round((cat.passed.length / total) * 100) : 0;
  });

  return categories;
}
```

Then in `adaptResultData()` around line 93:

```typescript
// BUILD categories if missing or empty
if (!result?.compliance?.categories || Object.keys(result.compliance.categories).length === 0) {
  adapted.compliance.categories = buildCategoriesFromData(issues, compliant);
} else {
  adapted.compliance.categories = result.compliance.categories;
}
```

**Pros**:
- ✅ Self-contained fix in one place
- ✅ Works even if backend doesn't send categories
- ✅ Consistent with existing frontend architecture
- ✅ No API changes needed

**Cons**:
- ⚠️ Duplicates backend logic (DRY violation)
- ⚠️ If mapping rules change, need to update both places

### Option 2: Backend Always Sends Categories

Ensure the backend **ALWAYS** builds and sends categories in ALL endpoints.

**Files to check**:
- `packages/server/src/routes/analyze.ts` - Analysis results
- `packages/server/src/routes/validation.ts` - Validation results  
- `packages/server/src/routes/results.ts` - Historical results

**Pros**:
- ✅ Single source of truth (backend)
- ✅ Frontend just renders what it receives
- ✅ Simpler frontend logic

**Cons**:
- ⚠️ Requires changes to multiple backend endpoints
- ⚠️ More complex migration
- ⚠️ Legacy data might not have categories

## UX Improvements Needed

Beyond fixing the calculation, make categories clearer:

### 1. **Empty State Handling**

When a category has **0 checks** (neither passed nor issues):

**Current**: Shows "0 passed / 0 issues" with 0%  
**Better**: Show "Not applicable" or "No checks in this category"

### 2. **Disabled Categories**

Some categories might be disabled in certain rulesets:

**Current**: Faded opacity  
**Better**: Clear label "Disabled in this configuration"

### 3. **Percentage Color Coding**

Already implemented correctly (lines 530):
- 🟢 Green: ≥ 80%
- 🟡 Yellow: 50-79%
- 🔴 Red: < 50%

### 4. **Category Explanations**

Add tooltips or info icons explaining what each category means:
- **Repository Management**: Files, folders, structure
- **Functional Requirements**: README, docs, features
- **Deployment**: Azure YAML, Bicep, workflows
- **Security**: Auth, secrets, best practices
- **Testing**: Test files, CI/CD
- **Agents**: agents.md file

## Implementation Plan

### Phase 1: Quick Fix (Recommended First)

1. **Add buildCategories() to adapt.ts** (30 min)
2. **Update adaptResultData() to build categories** (15 min)
3. **Test with existing analysis results** (15 min)
4. **Verify percentages display correctly** (10 min)

**Total**: ~1 hour

### Phase 2: UX Improvements (After Fix)

1. **Add empty state handling** (20 min)
2. **Add category tooltips/descriptions** (30 min)
3. **Improve disabled category styling** (15 min)

**Total**: ~1 hour

### Phase 3: Backend Cleanup (Optional)

1. **Audit all backend endpoints** (30 min)
2. **Ensure categories always sent** (45 min)
3. **Remove frontend buildCategories()** (15 min)

**Total**: ~1.5 hours

## Testing Checklist

After implementing the fix:

- [ ] Categories render with correct percentages
- [ ] Each category shows accurate passed/issues counts
- [ ] Percentages match manual calculation: `(passed / (passed + issues)) * 100`
- [ ] Empty categories handled gracefully
- [ ] Disabled categories display appropriately
- [ ] Works with different rulesets (dod, min, ai, custom)
- [ ] Console logs removed or changed to debug-only
- [ ] No regression in overall compliance percentage
- [ ] Category breakdown section always visible (if data exists)

## Files to Modify

### Immediate Fix:
- ✏️ `packages/app/src/dashboard/adapt.ts` - Add buildCategoriesFromData() function

### Testing:
- 🧪 Run existing dashboard in dev mode
- 🧪 Check browser console for category logs
- 🧪 Verify percentages match expected values

### Documentation:
- 📝 Update this analysis doc with final solution
- 📝 Add comments in code explaining category building logic

## Next Steps

1. **Review this analysis** with team
2. **Choose Option 1 (frontend fix)** for immediate resolution
3. **Implement buildCategoriesFromData()** in adapt.ts
4. **Test with multiple templates** to verify
5. **Open PR** with fix and tests
6. **Consider Phase 2 UX improvements** in follow-up PR

---

**Analysis completed**: 2025-01-XX  
**Status**: Ready for implementation  
**Estimated fix time**: 1 hour  
**Priority**: HIGH (user reported as blocking)
