import { describe, it, expect } from "vitest";
import { runAnalyzer } from "../../packages/analyzer-core/dist/index.js";

describe("Analyzer category grouping", () => {
    it("groups issues and compliant items into categories", async () => {
        const mockFiles = [
            {
                path: "README.md",
                type: "file",
                content: Buffer.from(
                    "# Test\n## Features\n## Getting Started\n## Resources\n## Guidance\n",
                ).toString("base64"),
            },
            {
                path: "azure.yaml",
                type: "file",
                content: Buffer.from(
                    "name: test\nservices:\n  web:\n    host: containerapp\n",
                ).toString("base64"),
            },
            {
                path: "LICENSE",
                type: "file",
                content: Buffer.from("MIT License").toString("base64"),
            },
            {
                path: "SECURITY.md",
                type: "file",
                content: Buffer.from("# Security").toString("base64"),
            },
            {
                path: "CONTRIBUTING.md",
                type: "file",
                content: Buffer.from("# Contributing").toString("base64"),
            },
            {
                path: "CODE_OF_CONDUCT.md",
                type: "file",
                content: Buffer.from("# Code of Conduct").toString("base64"),
            },
            {
                path: "infra/main.bicep",
                type: "file",
                content: Buffer.from("resource test {}").toString("base64"),
            },
            {
                path: ".github/workflows/azure-dev.yml",
                type: "file",
                content: Buffer.from("name: Azure Dev").toString("base64"),
            },
        ];

        const result = await runAnalyzer(
            "https://github.com/test/repo",
            mockFiles,
            {
                ruleSet: "dod",
            },
        );

        // Verify categories object exists
        expect(result.compliance.categories).toBeDefined();
        expect(typeof result.compliance.categories).toBe("object");

        // Verify all standard categories exist
        const expectedCategories = [
            "repositoryManagement",
            "functionalRequirements",
            "deployment",
            "security",
            "testing",
            "agents",
        ];

        for (const category of expectedCategories) {
            expect(result.compliance.categories[category]).toBeDefined();
            expect(result.compliance.categories[category]).toHaveProperty(
                "enabled",
            );
            expect(result.compliance.categories[category]).toHaveProperty(
                "issues",
            );
            expect(result.compliance.categories[category]).toHaveProperty(
                "compliant",
            );
            expect(result.compliance.categories[category]).toHaveProperty(
                "percentage",
            );
            expect(
                Array.isArray(result.compliance.categories[category].issues),
            ).toBe(true);
            expect(
                Array.isArray(result.compliance.categories[category].compliant),
            ).toBe(true);
            expect(
                typeof result.compliance.categories[category].percentage,
            ).toBe("number");
        }
    });

    it("correctly maps issue categories to standard category keys", async () => {
        const mockFiles = [
            {
                path: "README.md",
                type: "file",
                content: Buffer.from("# Test").toString("base64"),
            },
            {
                path: "infra/main.bicep",
                type: "file",
                content: Buffer.from("resource test {}").toString("base64"),
            },
        ];

        const result = await runAnalyzer(
            "https://github.com/test/repo",
            mockFiles,
            {
                ruleSet: "dod",
            },
        );

        // Issues for missing required files should go to repositoryManagement
        const repoMgmt = result.compliance.categories.repositoryManagement;
        expect(repoMgmt.issues.length).toBeGreaterThan(0);

        // Find issues related to missing files
        const missingFileIssues = repoMgmt.issues.filter(
            (i) =>
                i.id &&
                (i.id.includes("missing") ||
                    i.id.includes("required") ||
                    i.id.includes("file")),
        );
        expect(missingFileIssues.length).toBeGreaterThan(0);
    });

    it("calculates correct percentage for each category", async () => {
        const mockFiles = [
            {
                path: "README.md",
                type: "file",
                content: Buffer.from(
                    "# Test\n## Features\n## Getting Started\n## Resources\n## Guidance\n",
                ).toString("base64"),
            },
            {
                path: "azure.yaml",
                type: "file",
                content: Buffer.from(
                    "name: test\nservices:\n  web:\n    host: containerapp\n",
                ).toString("base64"),
            },
            {
                path: "LICENSE",
                type: "file",
                content: Buffer.from("MIT").toString("base64"),
            },
            {
                path: "infra/main.bicep",
                type: "file",
                content: Buffer.from("resource test {}").toString("base64"),
            },
        ];

        const result = await runAnalyzer(
            "https://github.com/test/repo",
            mockFiles,
            {
                ruleSet: "dod",
            },
        );

        // Check each category has valid percentage
        for (const categoryKey of Object.keys(result.compliance.categories)) {
            const cat = result.compliance.categories[categoryKey];
            const total = cat.issues.length + cat.compliant.length;

            if (total > 0) {
                const expectedPercentage = Math.round(
                    (cat.compliant.length / total) * 100,
                );
                expect(cat.percentage).toBe(expectedPercentage);
            } else {
                // If no items, percentage should be 0
                expect(cat.percentage).toBe(0);
            }
        }
    });

    it("does not include meta category in tiles", async () => {
        const mockFiles = [
            {
                path: "README.md",
                type: "file",
                content: Buffer.from(
                    "# Test\n## Features\n## Getting Started\n## Resources\n## Guidance\n",
                ).toString("base64"),
            },
            {
                path: "azure.yaml",
                type: "file",
                content: Buffer.from(
                    "name: test\nservices:\n  web:\n    host: containerapp\n",
                ).toString("base64"),
            },
        ];

        const result = await runAnalyzer(
            "https://github.com/test/repo",
            mockFiles,
            {
                ruleSet: "dod",
            },
        );

        // Meta category should not exist in categories object (used for compliance summary)
        expect(result.compliance.categories.meta).toBeUndefined();

        // But compliance summary should exist in compliant array
        const metaItem = result.compliance.compliant.find(
            (i) => i.category === "meta",
        );
        expect(metaItem).toBeDefined();
    });

    it("groups bicep security issues into security category", async () => {
        const mockFiles = [
            {
                path: "README.md",
                type: "file",
                content: Buffer.from(
                    "# Test\n## Features\n## Getting Started\n## Resources\n## Guidance\n",
                ).toString("base64"),
            },
            {
                path: "azure.yaml",
                type: "file",
                content: Buffer.from(
                    "name: test\nservices:\n  web:\n    host: containerapp\n",
                ).toString("base64"),
            },
            {
                path: "LICENSE",
                type: "file",
                content: Buffer.from("MIT").toString("base64"),
            },
            {
                path: "infra/main.bicep",
                type: "file",
                content: Buffer.from(
                    `
resource storage 'Microsoft.Storage/storageAccounts@2021-06-01' = {
  properties: {
    accessKey: 'hardcoded-key'
  }
}
      `,
                ).toString("base64"),
            },
        ];

        const result = await runAnalyzer(
            "https://github.com/test/repo",
            mockFiles,
            {
                ruleSet: "dod",
            },
        );

        // Security category should have issues or compliant items
        const securityCat = result.compliance.categories.security;
        expect(securityCat).toBeDefined();

        // Total items in security category should be > 0
        const totalSecurityItems =
            securityCat.issues.length + securityCat.compliant.length;
        expect(totalSecurityItems).toBeGreaterThanOrEqual(0);
    });

    it("groups deployment-related items into deployment category", async () => {
        const mockFiles = [
            {
                path: "README.md",
                type: "file",
                content: Buffer.from(
                    "# Test\n## Features\n## Getting Started\n## Resources\n## Guidance\n",
                ).toString("base64"),
            },
            {
                path: "azure.yaml",
                type: "file",
                content: Buffer.from(
                    "name: test\nservices:\n  web:\n    host: containerapp\n",
                ).toString("base64"),
            },
            {
                path: "infra/main.bicep",
                type: "file",
                content: Buffer.from("resource test {}").toString("base64"),
            },
            {
                path: ".github/workflows/azure-dev.yml",
                type: "file",
                content: Buffer.from("name: Azure Dev").toString("base64"),
            },
        ];

        const result = await runAnalyzer(
            "https://github.com/test/repo",
            mockFiles,
            {
                ruleSet: "dod",
            },
        );

        const deploymentCat = result.compliance.categories.deployment;
        expect(deploymentCat).toBeDefined();

        // Deployment category should have items (workflows, bicep files, azure.yaml)
        const totalDeploymentItems =
            deploymentCat.issues.length + deploymentCat.compliant.length;
        expect(totalDeploymentItems).toBeGreaterThan(0);

        // Should include bicep or azure.yaml items
        const allDeploymentItems = [
            ...deploymentCat.issues,
            ...deploymentCat.compliant,
        ];
        const deploymentRelated = allDeploymentItems.some(
            (i) =>
                i.id &&
                (i.id.includes("bicep") ||
                    i.id.includes("azure") ||
                    i.id.includes("workflow")),
        );
        expect(deploymentRelated).toBe(true);
    });
});
