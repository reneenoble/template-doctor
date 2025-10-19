/**
 * Unit Tests for AZD Validation Artifact Parsing
 *
 * Tests the artifact download and markdown parsing logic
 */

import { describe, it, expect, vi } from "vitest";
import {
    parseAzdValidationResult,
    downloadValidationArtifact,
} from "../src/services/azd-validation";
import AdmZip from "adm-zip";

vi.mock("adm-zip");

describe("parseAzdValidationResult (service)", () => {
    it("should parse successful validation with no warnings", () => {
        const markdown = `
## Validation Results
- [x] AZD Up (45.2s)
- [x] AZD Down (30.1s)
## Security Requirements
- [x] All checks passed
    `;

        const result = parseAzdValidationResult(markdown);

        expect(result.azdUpSuccess).toBe(true);
        expect(result.azdUpTime).toBe("45.2s");
        expect(result.azdDownSuccess).toBe(true);
        expect(result.azdDownTime).toBe("30.1s");
        expect(result.psRuleErrors).toBe(0);
        expect(result.psRuleWarnings).toBe(0);
        expect(result.securityStatus).toBe("pass");
        expect(result.overallStatus).toBe("success");
    });

    it("should parse validation with warnings", () => {
        const markdown = `
## Validation Results
- [x] :white_check_mark: AZD Up (50.0s)
- [x] :white_check_mark: AZD Down (25.5s)
## Security Requirements
:warning: Missing best practice
:warning: Outdated dependency
    `;

        const result = parseAzdValidationResult(markdown);

        expect(result.azdUpSuccess).toBe(true);
        expect(result.azdDownSuccess).toBe(true);
        expect(result.psRuleWarnings).toBe(2);
        expect(result.psRuleErrors).toBe(0);
        expect(result.securityStatus).toBe("warnings");
        expect(result.overallStatus).toBe("warning");
    });

    it("should parse validation with security errors", () => {
        const markdown = `
## Validation Results
- [x] AZD Up (40.0s)
- [x] AZD Down (20.0s)
## Security Requirements
- [ ] :x: Missing TLS encryption
- [ ] :x: Weak authentication
    `;

        const result = parseAzdValidationResult(markdown);

        expect(result.azdUpSuccess).toBe(true);
        expect(result.azdDownSuccess).toBe(true);
        expect(result.psRuleErrors).toBe(2);
        expect(result.securityStatus).toBe("errors");
        expect(result.overallStatus).toBe("failure"); // Errors = failure
    });

    it("should parse failed AZD Up", () => {
        const markdown = `
## Validation Results
- [ ] :x: AZD Up failed
- [ ] AZD Down not attempted
    `;

        const result = parseAzdValidationResult(markdown);

        expect(result.azdUpSuccess).toBe(false);
        expect(result.azdUpTime).toBeNull();
        expect(result.azdDownSuccess).toBe(false);
        expect(result.overallStatus).toBe("failure");
    });

    it("should parse AZD Up success but Down failure", () => {
        const markdown = `
## Validation Results
- [x] AZD Up (60.0s)
- [ ] :x: AZD Down failed
    `;

        const result = parseAzdValidationResult(markdown);

        expect(result.azdUpSuccess).toBe(true);
        expect(result.azdUpTime).toBe("60.0s");
        expect(result.azdDownSuccess).toBe(false);
        expect(result.overallStatus).toBe("failure");
    });

    it("should handle security scan failure marker", () => {
        const markdown = `
## Validation Results
- [x] AZD Up
- [x] AZD Down
- [ ] :x: Security Scan failed
    `;

        const result = parseAzdValidationResult(markdown);

        expect(result.securityStatus).toBe("errors");
        expect(result.overallStatus).toBe("failure");
    });

    it("should count warnings outside security section", () => {
        const markdown = `
## Validation Results
:warning: Deprecated API used
- [x] AZD Up
- [x] AZD Down
## Security Requirements
- [x] All passed
    `;

        const result = parseAzdValidationResult(markdown);

        expect(result.psRuleWarnings).toBe(1);
        expect(result.psRuleErrors).toBe(0);
        expect(result.securityStatus).toBe("warnings");
        expect(result.overallStatus).toBe("warning");
    });

    it("should handle mixed warnings and errors", () => {
        const markdown = `
## Validation Results
- [x] AZD Up
- [x] AZD Down
:warning: Minor issue
## Security Requirements
- [ ] :x: Critical vulnerability
:warning: Low priority warning
    `;

        const result = parseAzdValidationResult(markdown);

        expect(result.psRuleWarnings).toBe(2); // Both warnings counted
        expect(result.psRuleErrors).toBe(1); // Only security section errors
        expect(result.securityStatus).toBe("errors");
        expect(result.overallStatus).toBe("failure");
    });

    it("should extract time from various formats", () => {
        const formats = [
            { markdown: "- [x] AZD Up (45s)", expected: "45s" },
            { markdown: "- [x] AZD Up (1.5s)", expected: "1.5s" },
            { markdown: "- [x] AZD Up (120.25s)", expected: "120.25s" },
        ];

        formats.forEach(({ markdown, expected }) => {
            const result = parseAzdValidationResult(markdown);
            expect(result.azdUpTime).toBe(expected);
        });
    });

    it("should be case insensitive for azd commands", () => {
        const markdown = `
- [x] AZD UP (30s)
- [x] azd down (20s)
    `;

        const result = parseAzdValidationResult(markdown);

        expect(result.azdUpSuccess).toBe(true);
        expect(result.azdDownSuccess).toBe(true);
    });
});

describe("downloadValidationArtifact (service)", () => {
    const owner = "o";
    const repo = "r";
    const runId = 123;
    const token = "t";

    it("returns null when artifacts list fetch fails", async () => {
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 500 });
        const result = await downloadValidationArtifact(
            owner,
            repo,
            runId,
            token,
        );
        expect(result).toBeNull();
    });

    it("returns null when no validation artifact found", async () => {
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ artifacts: [{ name: "other-artifact" }] }),
            });
        const result = await downloadValidationArtifact(
            owner,
            repo,
            runId,
            token,
        );
        expect(result).toBeNull();
    });

    it("returns null when artifact download fails", async () => {
        global.fetch = vi
            .fn()
            // artifacts list
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    artifacts: [{ name: "abc-validation-result", id: 9 }],
                }),
            })
            // artifact download
            .mockResolvedValueOnce({ ok: false, status: 404 });
        const result = await downloadValidationArtifact(
            owner,
            repo,
            runId,
            token,
        );
        expect(result).toBeNull();
    });

    it("extracts markdown from ZIP (md preferred)", async () => {
        const mdEntry = {
            entryName: "result.md",
            isDirectory: false,
            getData: () => Buffer.from("# MD"),
        };
        (AdmZip as any).mockImplementation(() => ({
            getEntries: () => [mdEntry],
        }));
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    artifacts: [{ name: "abc-validation-result", id: 9 }],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => Buffer.from("zip"),
            });
        const result = await downloadValidationArtifact(
            owner,
            repo,
            runId,
            token,
        );
        expect(result).toBe("# MD");
    });

    it("falls back to .log when no .md file", async () => {
        const logEntry = {
            entryName: "out.log",
            isDirectory: false,
            getData: () => Buffer.from("LOG"),
        };
        (AdmZip as any).mockImplementation(() => ({
            getEntries: () => [logEntry],
        }));
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    artifacts: [{ name: "abc-validation-result", id: 9 }],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => Buffer.from("zip"),
            });
        const result = await downloadValidationArtifact(
            owner,
            repo,
            runId,
            token,
        );
        expect(result).toBe("LOG");
    });

    it("returns null if ZIP contains no files", async () => {
        (AdmZip as any).mockImplementation(() => ({ getEntries: () => [] }));
        global.fetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    artifacts: [{ name: "abc-validation-result", id: 9 }],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => Buffer.from("zip"),
            });
        const result = await downloadValidationArtifact(
            owner,
            repo,
            runId,
            token,
        );
        expect(result).toBeNull();
    });

    it("returns null on thrown exception", async () => {
        global.fetch = vi.fn().mockRejectedValueOnce(new Error("network boom"));
        const result = await downloadValidationArtifact(
            owner,
            repo,
            runId,
            token,
        );
        expect(result).toBeNull();
    });
});

describe("Issue Body Generation", () => {
    it("should extract deployment failures from markdown", () => {
        const markdown = `
(x) Failed: Region not available for model
(x) Failed: Insufficient quota
## Security Requirements
- [ ] :x: Missing encryption
    `;

        const failedSteps = markdown.match(/\(x\) Failed:.*$/gm) || [];

        expect(failedSteps).toHaveLength(2);
        expect(failedSteps[0]).toContain("Region not available");
        expect(failedSteps[1]).toContain("Insufficient quota");
    });

    it("should extract security section", () => {
        const markdown = `
## Validation Results
Some text
## Security Requirements
- [ ] :x: Missing TLS
- [ ] :x: Weak passwords
## Other Section
More text
    `;

        const securityMatch = markdown.match(
            /## Security Requirements:?([\s\S]*?)(?=##|$)/,
        );
        const securitySection = securityMatch ? securityMatch[1].trim() : "";

        expect(securitySection).toContain("Missing TLS");
        expect(securitySection).toContain("Weak passwords");
        expect(securitySection).not.toContain("Other Section");
    });

    it("should handle missing security section", () => {
        const markdown = `
## Validation Results
- [x] AZD Up
    `;

        const securityMatch = markdown.match(
            /## Security Requirements:([\s\S]*?)(?=##|$)/,
        );

        expect(securityMatch).toBeNull();
    });
});
