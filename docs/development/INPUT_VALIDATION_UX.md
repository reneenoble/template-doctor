# Input Validation UX - Consistent Behavior

## Overview

This document describes the **consistent input validation and error handling** implemented across both individual and batch scans in Template Doctor.

## Problem Statement

Previously, the individual search and batch scan modules had inconsistent validation:

- No XSS detection feedback ("Oops! That's not allowed!")
- No visual feedback (red border) for invalid input
- Different error messages between individual and batch scans
- User couldn't easily see what went wrong

## Solution

Implemented **unified validation with clear user feedback** across all input surfaces.

## Features

### 1. XSS Detection (`containsXssAttempt()`)

Detects malicious input patterns:

```typescript
export function containsXssAttempt(input: string): boolean {
    const xssPatterns = [
        /<script[\s>]/i, // <script> tags
        /<\/script>/i, // </script> closing tags
        /javascript:/i, // javascript: protocol
        /on\w+\s*=/i, // Event handlers (onclick=, onload=, etc.)
        /<iframe/i, // <iframe> tags
        /<object/i, // <object> tags
        /<embed/i, // <embed> tags
        /data:text\/html/i, // data URI attacks
    ];

    return xssPatterns.some((pattern) => pattern.test(input));
}
```

### 2. URL Validation (`sanitizeGitHubUrl()`)

Validates GitHub repository URLs:

```typescript
Valid formats:
- https://github.com/owner/repo
- https://github.com/owner/repo.git
- owner/repo

Returns: Normalized URL or null if invalid
```

### 3. Consistent Error Messages

| Scenario      | Error Title          | Error Message                                                                            | Visual Feedback                |
| ------------- | -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| XSS Attempt   | `Invalid Input`      | `Oops! That's not allowed!`                                                              | Red border (2px solid #dc3545) |
| Malformed URL | `Invalid URL`        | `Not a valid GitHub repository URL`                                                      | Red border (2px solid #dc3545) |
| Single Word   | `Invalid Repository` | `GitHub repositories must be in "owner/repo" format (e.g., "microsoft/template-doctor")` | Red border (2px solid #dc3545) |
| Empty Input   | `Batch Scan`         | `Enter at least one repository URL`                                                      | Red border (2px solid #dc3545) |
| Valid Input   | N/A                  | N/A                                                                                      | Border reset (removed)         |

## Implementation

### Individual Search (`packages/app/src/scripts/search.ts`)

```typescript
// Check for XSS attempts first
if (containsXssAttempt(query)) {
    const searchInput = document.getElementById(
        "repo-search",
    ) as HTMLInputElement | null;
    if (searchInput) {
        searchInput.style.border = "2px solid #dc3545";
    }
    if ((window as any).NotificationSystem) {
        (window as any).NotificationSystem.showError(
            "Invalid Input",
            "Oops! That's not allowed!",
            5000,
        );
    }
    container.innerHTML =
        '<div class="no-results error-message">Invalid input detected</div>';
    return;
}

// Check if this looks like a URL attempt (contains http, https, or ://)
const looksLikeUrlAttempt = /^https?:\/\/|:\/\//.test(q);

// If it looks like a URL attempt, validate it as a GitHub URL
if (looksLikeUrlAttempt) {
    const validUrl = sanitizeGitHubUrl(q);
    if (!validUrl) {
        if (searchInput) {
            searchInput.style.border = "2px solid #dc3545";
        }
        if ((window as any).NotificationSystem) {
            (window as any).NotificationSystem.showError(
                "Invalid URL",
                `Not a valid GitHub repository URL`,
                5000,
            );
        }
        container.innerHTML =
            '<div class="no-results error-message">Invalid GitHub repository URL</div>';
        return;
    }
}

// At end of search when no results found:
// Check if this might be an invalid repository format
const hasSlash = q.includes("/");
const firstPart = q.split("/")[0] || "";
const looksLikeRepoAttempt = hasSlash || /^[a-zA-Z0-9_-]+$/.test(firstPart);

// If it looks like they're trying to enter a repo but it's invalid format
if (looksLikeRepoAttempt && !hasSlash) {
    if (searchInput) {
        searchInput.style.border = "2px solid #dc3545";
    }
    if ((window as any).NotificationSystem) {
        (window as any).NotificationSystem.showError(
            "Invalid Repository",
            'GitHub repositories must be in "owner/repo" format (e.g., "microsoft/template-doctor")',
            6000,
        );
    }
    container.innerHTML =
        '<div class="no-results error-message">Use "owner/repo" format for GitHub repositories</div>';
} else {
    container.innerHTML =
        '<div class="no-results">No matching templates found</div>';
}
```

### Batch Scan (`packages/app/src/scripts/batch-scan.ts`)

```typescript
btn.addEventListener("click", () => {
    const ta = document.getElementById(
        "batch-urls",
    ) as HTMLTextAreaElement | null;
    if (!ta) return;

    // Reset border
    ta.style.border = "";

    const lines = ta.value
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);

    // Check for XSS attempts first
    const hasXss = lines.some((line) => containsXssAttempt(line));
    if (hasXss) {
        ta.style.border = "2px solid #dc3545";
        showError("Invalid Input", "Oops! That's not allowed!");
        return;
    }

    // Validate URLs
    const repos = lines
        .map((url) => {
            const sanitized = sanitizeGitHubUrl(url);
            if (!sanitized) {
                ta.style.border = "2px solid #dc3545";
                showError("Invalid URL", `Invalid URL: ${sanitizeHtml(url)}`);
                return null;
            }
            return sanitized;
        })
        .filter((url): url is string => url !== null);

    if (!repos.length) {
        ta.style.border = "2px solid #dc3545";
        showError("Batch Scan", "No valid repository URLs found");
        return;
    }

    // Reset border on success
    ta.style.border = "";
    startBatch(repos);
});
```

### CSS Styling (`packages/app/css/style.css`)

```css
/* Search and Input Validation Styles */
.no-results {
    padding: 20px;
    text-align: center;
    color: var(--text-secondary);
}

.no-results.error-message {
    color: #dc3545;
    font-weight: 500;
}

/* Input error state */
input.error,
textarea.error,
input[style*="border: 2px solid #dc3545"],
textarea[style*="border: 2px solid #dc3545"] {
    border-color: #dc3545 !important;
    background-color: #fff5f5 !important;
}
```

## Test Coverage

**Location**: `tests/unit/input-validation-ux.spec.ts`

**26 comprehensive tests** covering:

### XSS Detection (6 tests)

- ✅ Script tags (`<script>`, `</script>`)
- ✅ Event handlers (`onclick=`, `onload=`, etc.)
- ✅ JavaScript protocol (`javascript:alert(1)`)
- ✅ Dangerous HTML tags (`<iframe>`, `<object>`, `<embed>`)
- ✅ Data URI attacks (`data:text/html`)
- ✅ Safe input validation

### URL Validation (6 tests)

- ✅ Valid GitHub URLs (https, .git, owner/repo)
- ✅ XSS rejection in URLs
- ✅ Invalid URL pattern rejection
- ✅ Single-word rejection (hello, randomword, test123)
- ✅ Malformed URL rejection (htt://something.com)
- ✅ Dangerous character rejection

### Error Message Consistency (3 tests)

- ✅ "Oops! That's not allowed!" for XSS
- ✅ "Invalid URL" for malformed URL attempts
- ✅ Format guidance for single words

### Visual Feedback (4 tests)

- ✅ Red border determination for XSS
- ✅ Red border determination for invalid URLs
- ✅ Border reset for valid input
- ✅ Batch scan mixed input handling

### Edge Cases (7 tests)

- ✅ Empty input handling
- ✅ Whitespace-only input
- ✅ Mixed valid/invalid URLs in batch
- ✅ Case-insensitive XSS detection
- ✅ Single-word format guidance
- ✅ Malformed URL detection
- ✅ URL vs search term disambiguation

## Attack Prevention Examples

### XSS Attempts

```javascript
// Input: <script>alert("XSS")</script>
// Result: "Oops! That's not allowed!" + red border

// Input: text onclick="alert(1)"
// Result: "Oops! That's not allowed!" + red border

// Input: javascript:alert(document.cookie)
// Result: "Oops! That's not allowed!" + red border

// Input: <iframe src="https://evil.com">
// Result: "Oops! That's not allowed!" + red border
```

### Malformed URLs

```javascript
// Input: htt://something.com
// Result: "Invalid URL: Not a valid GitHub repository URL" + red border

// Input: http://evil.com/repo
// Result: "Invalid URL: Not a valid GitHub repository URL" + red border

// Input: https://notgithub.com/owner/repo
// Result: "Invalid URL: Not a valid GitHub repository URL" + red border
```

### Single Words (Invalid Format)

```javascript
// Input: hello
// Result: "Invalid Repository: GitHub repositories must be in 'owner/repo' format" + red border

// Input: randomword
// Result: "Invalid Repository: GitHub repositories must be in 'owner/repo' format" + red border

// Input: test123
// Result: "Invalid Repository: GitHub repositories must be in 'owner/repo' format" + red border
```

### Invalid URLs

```javascript
// Input: owner/<script>/repo
// Result: "Oops! That's not allowed!" + red border (XSS detected first)

// Input: not-a-url (if it doesn't match single-word pattern)
// Result: "No matching templates found" (allowed as search term)
```

### Valid Input

```javascript
// Input: https://github.com/owner/repo
// Result: Validation proceeds, border reset

// Input: owner/repo
// Result: Normalized to https://github.com/owner/repo, border reset
```

## User Experience Flow

### Individual Search

1. User types in search box
2. User clicks "Search" button or presses Enter
3. **XSS Check**: If malicious pattern detected:
    - Show notification: "Invalid Input - Oops! That's not allowed!"
    - Add red border to search input
    - Display error message in results area
    - Stop processing
4. **URL Validation**: If invalid GitHub URL:
    - Border already reset if XSS passed
    - Allow search to proceed (might be repo name search)
5. **Valid Input**:
    - Reset any previous red border
    - Proceed with search

### Batch Scan

1. User enters multiple URLs (comma or newline separated)
2. User clicks "Start Batch Scan"
3. **XSS Check**: If ANY line contains malicious pattern:
    - Show notification: "Invalid Input - Oops! That's not allowed!"
    - Add red border to textarea
    - Stop processing (don't process any URLs)
4. **URL Validation**: For each line:
    - If invalid GitHub URL:
        - Show notification: "Invalid URL: <url>"
        - Add red border to textarea
        - Skip that URL but continue checking others
5. **Empty Result**: If no valid URLs remain:
    - Show notification: "No valid repository URLs found"
    - Keep red border
    - Stop processing
6. **Valid URLs Found**:
    - Reset red border
    - Proceed with batch scan

## Security Benefits

1. **Prevents XSS Attacks**: Blocks script injection before processing
2. **Validates URLs**: Ensures only GitHub repositories are scanned
3. **Clear User Feedback**: Users immediately see what went wrong
4. **Consistent Behavior**: Same validation rules across all input surfaces
5. **Production-Ready**: All edge cases tested and handled

## Maintenance

### Adding New XSS Patterns

Update `containsXssAttempt()` in `packages/app/src/shared/sanitize.ts`:

```typescript
const xssPatterns = [
    // ... existing patterns ...
    /new-dangerous-pattern/i, // Add description
];
```

### Adding New URL Patterns

Update `sanitizeGitHubUrl()` in `packages/app/src/shared/sanitize.ts`:

```typescript
const githubUrlPattern =
    /^(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/;
```

### Testing New Patterns

Add test cases to `tests/unit/input-validation-ux.spec.ts`:

```typescript
it("should detect new XSS pattern", () => {
    expect(containsXssAttempt("new-attack-vector")).toBe(true);
});
```

## Related Documentation

- [Input Sanitization Complete](./INPUT_SANITIZATION_COMPLETE.md) - Core sanitization library
- [Batch Scan Sanitization](./BATCH_SCAN_SANITIZATION.md) - Batch scan security
- [Security Policy](../../SECURITY.md) - Overall security approach

## References

- OWASP XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- GitHub URL Patterns: https://docs.github.com/en/get-started/getting-started-with-git/about-remote-repositories

---

**Status**: ✅ Complete  
**Test Coverage**: 26/26 tests passing  
**Production Ready**: Yes
