import AdmZip from "adm-zip";

export interface AzdValidationResult {
    azdUpSuccess: boolean;
    azdUpTime: string | null;
    azdDownSuccess: boolean;
    azdDownTime: string | null;
    psRuleErrors: number;
    psRuleWarnings: number;
    securityStatus: "pass" | "warnings" | "errors";
    overallStatus: "success" | "warning" | "failure";
    resultFileContent: string;
}

/**
 * Downloads and extracts the validation result artifact from a GitHub workflow run.
 * Returns the markdown content or null if not found / error.
 */
export async function downloadValidationArtifact(
    owner: string,
    repo: string,
    runId: number,
    token: string,
): Promise<string | null> {
    try {
        const artifactsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
        const artifactsResponse = await fetch(artifactsUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });
        if (!artifactsResponse.ok) {
            console.error("[azd-validation] fetch artifacts failed", {
                status: artifactsResponse.status,
                runId,
            });
            return null;
        }
        const artifactsData = await artifactsResponse.json();
        const validationArtifact = artifactsData.artifacts?.find((a: any) =>
            a.name.endsWith("-validation-result"),
        );
        if (!validationArtifact) {
            return null; // Not yet uploaded or workflow variant without artifact
        }

        const downloadUrl = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${validationArtifact.id}/zip`;
        const downloadResponse = await fetch(downloadUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
            },
        });
        if (!downloadResponse.ok) {
            console.error("[azd-validation] artifact download failed", {
                status: downloadResponse.status,
                artifactId: validationArtifact.id,
            });
            return null;
        }

        const buffer = Buffer.from(await downloadResponse.arrayBuffer());
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();

        let resultEntry =
            entries.find(
                (e) => !e.isDirectory && e.entryName.endsWith(".md"),
            ) ||
            entries.find(
                (e) => !e.isDirectory && e.entryName.endsWith(".log"),
            ) ||
            entries.find((e) => !e.isDirectory);

        if (!resultEntry) {
            console.error("[azd-validation] no result file in artifact ZIP", {
                artifactId: validationArtifact.id,
                entries: entries.map((e) => e.entryName),
            });
            return null;
        }

        return resultEntry.getData().toString("utf8");
    } catch (error) {
        console.error("[azd-validation] artifact processing error", {
            error,
            runId,
        });
        return null;
    }
}

/**
 * Parse the validation artifact markdown to structured result.
 */
export function parseAzdValidationResult(
    markdown: string,
): AzdValidationResult {
    const azdUpSuccess =
        /- \[x\].*azd up/i.test(markdown) ||
        /:white_check_mark:.*azd up/i.test(markdown);
    const azdDownSuccess =
        /- \[x\].*azd down/i.test(markdown) ||
        /:white_check_mark:.*azd down/i.test(markdown);
    // Time extraction: support '(123s)', '(123.45s)', bracket lists e.g. '[ (45.2s) ]', or without case sensitivity
    const timePattern = /azd up[^\n]*\(([0-9]+(?:\.[0-9]+)?s)\)/i;
    const timePatternDown = /azd down[^\n]*\(([0-9]+(?:\.[0-9]+)?s)\)/i;
    const azdUpTime = markdown.match(timePattern)?.[1] || null;
    const azdDownTime = markdown.match(timePatternDown)?.[1] || null;
    const psRuleWarnings = (markdown.match(/:warning:/g) || []).length;
    const securitySection = markdown.split("## Security Requirements")[1] || "";
    const psRuleErrors = (securitySection.match(/- \[ \] :x:/g) || []).length;
    const securityScanFailed = /- \[ \] :x:.*Security Scan/i.test(markdown);

    let securityStatus: AzdValidationResult["securityStatus"];
    if (psRuleErrors > 0 || securityScanFailed) securityStatus = "errors";
    else if (psRuleWarnings > 0) securityStatus = "warnings";
    else securityStatus = "pass";

    let overallStatus: AzdValidationResult["overallStatus"];
    if (azdUpSuccess && azdDownSuccess && !securityScanFailed) {
        if (psRuleErrors === 0) {
            overallStatus = psRuleWarnings > 0 ? "warning" : "success";
        } else {
            overallStatus = "failure";
        }
    } else if (azdUpSuccess && azdDownSuccess && securityScanFailed) {
        overallStatus = "failure";
    } else if (!azdUpSuccess || !azdDownSuccess) {
        overallStatus = "failure";
    } else {
        overallStatus = "failure";
    }

    return {
        azdUpSuccess,
        azdUpTime,
        azdDownSuccess,
        azdDownTime,
        psRuleErrors,
        psRuleWarnings,
        securityStatus,
        overallStatus,
        resultFileContent: markdown,
    };
}
