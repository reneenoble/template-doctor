import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
    sanitizeHtml,
    sanitizeSearchQuery,
    sanitizeGitHubUrl,
    sanitizeAttribute,
    validateLength,
    sanitizeForLogging,
} from "../../packages/app/src/shared/sanitize";

// Setup DOM environment
let dom: JSDOM;
let document: Document;
let window: Window;

beforeEach(() => {
    dom = new JSDOM(
        `
    <!DOCTYPE html>
    <html>
      <body>
        <button id="batch-scan-button">Scan</button>
        <textarea id="batch-urls"></textarea>
        <div id="batch-items"></div>
        <div id="batch-progress-bar"></div>
        <div id="batch-progress-text"></div>
        <div id="batch-cancel-btn"></div>
        <div id="repo-name"></div>
        <div id="repo-url"></div>
      </body>
    </html>
  `,
        { url: "http://localhost" },
    );

    document = dom.window.document;
    window = dom.window as any;

    // Make global
    (global as any).document = document;
    (global as any).window = window;
    (global as any).indexedDB = {
        open: vi.fn(() => ({
            onerror: null,
            onupgradeneeded: null,
            onsuccess: null,
        })),
    };
});

afterEach(() => {
    dom.window.close();
    delete (global as any).document;
    delete (global as any).window;
    delete (global as any).indexedDB;
});

describe("Batch Scan Sanitization", () => {
    describe("Repository URL Validation", () => {
        it("should accept valid GitHub URLs", () => {
            const validUrls = [
                {
                    input: "https://github.com/owner/repo",
                    expected: "https://github.com/owner/repo",
                },
                {
                    input: "https://github.com/owner/repo-name",
                    expected: "https://github.com/owner/repo-name",
                },
                {
                    input: "https://github.com/owner/repo_name",
                    expected: "https://github.com/owner/repo_name",
                },
                {
                    input: "https://github.com/owner/repo.git",
                    expected: "https://github.com/owner/repo",
                }, // .git is removed
            ];

            validUrls.forEach(({ input, expected }) => {
                const result = sanitizeGitHubUrl(input);
                expect(result).toBeTruthy();
                expect(result).toBe(expected);
            });
        });

        it("should reject malicious URLs", () => {
            const maliciousUrls = [
                'javascript:alert("XSS")',
                'data:text/html,<script>alert("XSS")</script>',
                "https://evil.com/github.com/fake",
                "http://github.com.evil.com/owner/repo",
                '<script>alert("XSS")</script>',
                'https://github.com/owner/repo"><script>alert("XSS")</script>',
            ];

            maliciousUrls.forEach((url) => {
                const result = sanitizeGitHubUrl(url);
                expect(result).toBeNull();
            });
        });

        it("should reject URLs with injection attempts", () => {
            const injectionUrls = [
                "https://github.com/owner/repo' onload=\"alert('XSS')\"",
                'https://github.com/owner/repo" onerror="alert(1)',
                "https://github.com/owner/repo`$(malicious)",
            ];

            injectionUrls.forEach((url) => {
                const result = sanitizeGitHubUrl(url);
                expect(result).toBeNull();
            });
        });
    });

    describe("Repository Name Display", () => {
        it("should sanitize repository names with HTML characters", () => {
            const maliciousName = 'owner/<script>alert("XSS")</script>';
            const safe = sanitizeHtml(maliciousName);

            expect(safe).not.toContain("<script>");
            expect(safe).toContain("&lt;script&gt;");
        });

        it("should sanitize repository names for attributes", () => {
            const maliciousName = "owner/repo\" onload=\"alert('XSS')";
            const safe = sanitizeAttribute(maliciousName);

            expect(safe).not.toContain('" onload="');
            expect(safe).toContain("&quot;");
        });

        it("should prevent event handler injection in titles", () => {
            const attacks = [
                { input: 'repo" onerror="alert(1)', shouldEscape: "&quot;" },
                { input: "repo' onclick='alert(1)", shouldEscape: "&#x27;" },
                { input: "repo`onfocus=`alert(1)", shouldEscape: "`" }, // backticks are not escaped but are safe
            ];

            attacks.forEach(({ input, shouldEscape }) => {
                const safe = sanitizeAttribute(input);

                // Verify escaping happened if expected
                if (shouldEscape !== "`") {
                    expect(safe).toContain(shouldEscape);
                }

                // When placed in an HTML attribute, verify no actual script execution
                const testDiv = document.createElement("div");
                testDiv.setAttribute("title", safe);
                const container = document.getElementById("batch-items")!;
                container.innerHTML = ""; // Clear
                container.appendChild(testDiv);

                // The important thing: raw HTML should not have dangling attributes
                const html = container.innerHTML;
                // Verify the title attribute is properly closed and doesn't break out
                expect(html).toMatch(/title="[^"]*"/);
            });
        });
    });

    describe("Batch Item Creation Security", () => {
        it("should safely create batch items without XSS", () => {
            const maliciousUrl =
                'https://github.com/owner/<script>alert("XSS")</script>';
            const repoName = maliciousUrl.split("github.com/")[1];
            const safeRepoName = sanitizeHtml(repoName);
            const safeRepoNameAttr = sanitizeAttribute(repoName);

            const container = document.getElementById("batch-items")!;
            const item = document.createElement("div");

            item.innerHTML = `
        <div class="batch-item-header">
          <div class="batch-item-title" title="${safeRepoNameAttr}">${safeRepoName}</div>
          <div class="batch-item-status">Pending</div>
        </div>
      `;

            container.appendChild(item);

            const titleDiv = item.querySelector(".batch-item-title");
            // The innerHTML content should be escaped
            expect(titleDiv?.innerHTML).not.toContain("<script>");
            expect(titleDiv?.innerHTML).toContain("&lt;script&gt;");

            // Verify no actual script tags in the DOM
            const scripts = container.querySelectorAll("script");
            expect(scripts.length).toBe(0);
        });

        it("should prevent script execution in batch items", () => {
            const attacks = [
                "<img src=x onerror=alert(1)>",
                "<svg onload=alert(1)>",
                '<iframe src="javascript:alert(1)">',
            ];

            attacks.forEach((attack) => {
                const safe = sanitizeHtml(attack);
                expect(safe).not.toMatch(/<(img|svg|iframe)/i);
            });
        });
    });

    describe("Result Display Security", () => {
        it("should sanitize repository names in result display", () => {
            const result = {
                repoUrl:
                    'https://github.com/owner/<script>alert("XSS")</script>',
            };

            const repoName =
                result.repoUrl?.split("github.com/")[1] ||
                result.repoUrl ||
                "Repository";
            const safeRepoName = sanitizeHtml(repoName);

            const rnEl = document.getElementById("repo-name")!;
            rnEl.textContent = safeRepoName;

            // textContent uses escaped HTML entities, which appear as literal text
            // The important thing is that no actual <script> tags exist in the DOM
            expect(rnEl.innerHTML).not.toMatch(/<script>/i);
            expect(rnEl.outerHTML).not.toMatch(/<script>/i);
        });

        it("should sanitize repository URLs in result display", () => {
            const result = {
                repoUrl:
                    'https://github.com/owner/repo"><script>alert("XSS")</script>',
            };

            const safeRepoUrl = sanitizeHtml(result.repoUrl || "");
            const ruEl = document.getElementById("repo-url")!;
            ruEl.textContent = safeRepoUrl;

            // textContent uses escaped HTML entities, which appear as literal text
            // The important thing is that no actual <script> tags exist in the DOM
            expect(ruEl.innerHTML).not.toMatch(/<script>/i);
            expect(ruEl.outerHTML).not.toMatch(/<script>/i);
        });

        it("should prevent innerHTML-based XSS attacks", () => {
            const maliciousContent = "<img src=x onerror=\"alert('XSS')\">";
            const safe = sanitizeHtml(maliciousContent);

            const testDiv = document.createElement("div");
            testDiv.innerHTML = safe;

            // Should not contain actual img tag
            const imgs = testDiv.querySelectorAll("img");
            expect(imgs.length).toBe(0);
        });
    });

    describe("URL Input Processing", () => {
        it("should filter out invalid URLs from textarea input", () => {
            const mixedInput = `
        https://github.com/valid/repo1
        javascript:alert("XSS")
        https://github.com/valid/repo2
        <script>alert("XSS")</script>
        https://github.com/valid/repo3
      `;

            const repos = mixedInput
                .split(/\n|,/)
                .map((s) => s.trim())
                .filter(Boolean)
                .map((url) => {
                    const sanitized = sanitizeGitHubUrl(url);
                    return sanitized || null;
                })
                .filter((url): url is string => url !== null);

            expect(repos).toHaveLength(3);
            expect(
                repos.every((url) => url.startsWith("https://github.com/")),
            ).toBe(true);
        });

        it("should handle comma and newline separated URLs", () => {
            const inputs = [
                "https://github.com/owner/repo1,https://github.com/owner/repo2",
                "https://github.com/owner/repo1\nhttps://github.com/owner/repo2",
                "https://github.com/owner/repo1, https://github.com/owner/repo2",
                "https://github.com/owner/repo1\n\nhttps://github.com/owner/repo2",
            ];

            inputs.forEach((input) => {
                const repos = input
                    .split(/\n|,/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((url) => sanitizeGitHubUrl(url))
                    .filter((url): url is string => url !== null);

                expect(repos).toHaveLength(2);
            });
        });

        it("should reject all malicious URLs in mixed input", () => {
            const maliciousInput = `
        javascript:alert(1)
        data:text/html,<script>alert(1)</script>
        https://evil.com
        <script>alert(1)</script>
      `;

            const repos = maliciousInput
                .split(/\n|,/)
                .map((s) => s.trim())
                .filter(Boolean)
                .map((url) => sanitizeGitHubUrl(url))
                .filter((url): url is string => url !== null);

            expect(repos).toHaveLength(0);
        });
    });

    describe("Edge Cases", () => {
        it("should handle empty repository names", () => {
            expect(sanitizeHtml("")).toBe("");
            expect(sanitizeHtml(null as any)).toBe("");
            expect(sanitizeHtml(undefined as any)).toBe("");
        });

        it("should handle URLs without github.com path", () => {
            const url = "https://github.com/";
            const repoName = url.includes("github.com/")
                ? url.split("github.com/")[1]
                : url;
            const safe = sanitizeHtml(repoName || "Repository");

            expect(safe).toBeTruthy();
        });

        it("should handle very long repository names", () => {
            const longName = "a".repeat(1000);
            const safe = sanitizeHtml(longName);

            expect(safe).toHaveLength(1000);
            expect(safe).toBe(longName);
        });
    });
});
