# Batch Scan Input Sanitization

## Overview

This document describes the input sanitization and XSS prevention measures applied to the batch scan functionality in Template Doctor.

## Security Enhancements

### 1. URL Validation (`packages/app/src/scripts/batch-scan.ts`)

**Input Point**: Textarea where users paste repository URLs

**Protection**:

- URLs validated using `sanitizeGitHubUrl()` before processing
- Invalid URLs are rejected and show error notification
- Only valid GitHub URLs (`https://github.com/owner/repo`) are accepted

**Code**:

```typescript
const repos = ta.value
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => {
        const sanitized = sanitizeGitHubUrl(url);
        if (!sanitized) {
            showError(
                "Invalid URL",
                `Skipping invalid URL: ${sanitizeHtml(url)}`,
            );
            return null;
        }
        return sanitized;
    })
    .filter((url): url is string => url !== null);
```

### 2. Repository Name Display (`createBatchItem()`)

**Display Point**: Batch item UI showing repository name and status

**Protection**:

- Repository names sanitized with `sanitizeHtml()` for display content
- Repository names sanitized with `sanitizeAttribute()` for title attributes
- Prevents XSS via malicious repository names

**Code**:

```typescript
const repoName = url.includes("github.com/")
    ? url.split("github.com/")[1]
    : url;
const safeRepoName = sanitizeHtml(repoName);
const safeRepoNameAttr = sanitizeAttribute(repoName);

item.innerHTML = `
  <div class="batch-item-header">
    <div class="batch-item-title" title="${safeRepoNameAttr}">${safeRepoName}</div>
    <div class="batch-item-status">${status}</div>
  </div>
`;
```

### 3. Result Display (`displayResult()`)

**Display Point**: Analysis results showing repository name and URL

**Protection**:

- Repository name and URL sanitized before display
- Uses textContent for safe text rendering
- Prevents XSS in result metadata

**Code**:

```typescript
const repoName =
    result.repoUrl?.split("github.com/")[1] || result.repoUrl || "Repository";
const safeRepoName = sanitizeHtml(repoName);
const safeRepoUrl = sanitizeHtml(result.repoUrl || "");

const rnEl = document.getElementById("repo-name");
if (rnEl) rnEl.textContent = safeRepoName;
const ruEl = document.getElementById("repo-url");
if (ruEl) ruEl.textContent = safeRepoUrl;
```

## Attack Vectors Prevented

### 1. JavaScript URL Injection

**Attack**: `javascript:alert("XSS")`  
**Prevention**: `sanitizeGitHubUrl()` rejects non-GitHub URLs

### 2. Script Tag Injection

**Attack**: `https://github.com/owner/<script>alert("XSS")</script>`  
**Prevention**: `sanitizeHtml()` escapes to `&lt;script&gt;...&lt;/script&gt;`

### 3. Attribute Injection

**Attack**: `https://github.com/owner/repo" onerror="alert(1)`  
**Prevention**: `sanitizeAttribute()` escapes quotes to `&quot;`

### 4. Event Handler Injection

**Attack**: `repo' onclick='alert(1)`  
**Prevention**: `sanitizeAttribute()` escapes single quotes to `&#x27;`

### 5. Data URL Injection

**Attack**: `data:text/html,<script>alert(1)</script>`  
**Prevention**: `sanitizeGitHubUrl()` rejects non-HTTPS URLs

## Test Coverage

### Test File: `tests/unit/batch-scan-sanitization.spec.ts`

**17 Tests** covering:

1. **Repository URL Validation** (3 tests)
    - Accept valid GitHub URLs
    - Reject malicious URLs
    - Reject injection attempts

2. **Repository Name Display** (3 tests)
    - Sanitize HTML characters
    - Sanitize attribute values
    - Prevent event handler injection

3. **Batch Item Creation Security** (2 tests)
    - Safe batch item creation
    - Prevent script execution

4. **Result Display Security** (3 tests)
    - Sanitize repository names
    - Sanitize repository URLs
    - Prevent innerHTML XSS

5. **URL Input Processing** (3 tests)
    - Filter invalid URLs
    - Handle delimiter variations
    - Reject malicious input

6. **Edge Cases** (3 tests)
    - Empty input handling
    - Missing path handling
    - Long name handling

### Running Tests

```bash
# Run batch scan sanitization tests only
npm run test:unit -- batch-scan-sanitization

# Run all unit tests
npm run test:unit
```

### Test Results

```
✓ tests/unit/batch-scan-sanitization.spec.ts (17 tests)
   ✓ Batch Scan Sanitization (17 tests)
      ✓ Repository URL Validation (3 tests)
      ✓ Repository Name Display (3 tests)
      ✓ Batch Item Creation Security (2 tests)
      ✓ Result Display Security (3 tests)
      ✓ URL Input Processing (3 tests)
      ✓ Edge Cases (3 tests)

Test Files  1 passed (1)
     Tests  17 passed (17)
```

## Impact

### Files Modified

- `packages/app/src/scripts/batch-scan.ts` - Added sanitization imports and usage
- `tests/unit/batch-scan-sanitization.spec.ts` - New comprehensive test suite (17 tests)

### Security Posture

- **Before**: Batch scan accepted any input, vulnerable to XSS attacks
- **After**: All input validated and sanitized, XSS attacks prevented

### User Experience

- Invalid URLs show error notification with sanitized feedback
- Legitimate workflows unaffected
- Malicious input safely rejected

## Related Documentation

- [Input Sanitization](./INPUT_SANITIZATION_COMPLETE.md) - Core sanitization utilities
- [Search Module Security](../../packages/app/src/scripts/search.ts) - Search sanitization implementation
- [Security Policy](../../SECURITY.md) - Overall security guidelines

## Future Enhancements

1. **Rate Limiting**: Prevent abuse of batch scan endpoint
2. **URL Validation Logging**: Track rejected URLs for security monitoring
3. **Content Security Policy**: Add CSP headers to prevent inline script execution
4. **Batch Size Limits**: Enforce maximum number of URLs per batch

## Maintenance

When modifying batch scan functionality:

1. ✅ Always use `sanitizeGitHubUrl()` for URL input
2. ✅ Always use `sanitizeHtml()` for display content
3. ✅ Always use `sanitizeAttribute()` for HTML attributes
4. ✅ Add tests for new display paths
5. ✅ Run security test suite before committing
6. ⚠️ Never use raw user input in `innerHTML` or attributes
7. ⚠️ Never bypass sanitization for "performance reasons"

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [MDN: textContent vs innerHTML](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent)
- [HTML5 Security Cheatsheet](https://html5sec.org/)
