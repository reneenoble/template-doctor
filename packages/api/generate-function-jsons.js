// Generate function.json files for all compiled functions
const fs = require("fs");
const path = require("path");

const functions = [
    {
        name: "runtime-config",
        route: "v4/client-settings",
        methods: ["get", "head", "options"],
    },
    {
        name: "github-oauth-token",
        route: "v4/github-oauth-token",
        methods: ["post", "options"],
    },
    {
        name: "analyze-template",
        route: "v4/analyze-template",
        methods: ["post", "options"],
    },
    {
        name: "validation-template",
        route: "v4/validation-template",
        methods: ["post", "options"],
    },
    {
        name: "validation-status",
        route: "v4/validation-status",
        methods: ["get", "post", "options"],
    },
    {
        name: "validation-cancel",
        route: "v4/validation-cancel",
        methods: ["post", "options"],
    },
    {
        name: "validation-callback",
        route: "v4/validation-callback",
        methods: ["post", "options"],
    },
    {
        name: "validation-ossf",
        route: "v4/validation-ossf",
        methods: ["post", "options"],
    },
    {
        name: "validation-docker-image",
        route: "v4/validation-docker-image",
        methods: ["post", "options"],
    },
    {
        name: "archive-collection",
        route: "v4/archive-collection",
        methods: ["get", "options"],
    },
    {
        name: "add-template-pr",
        route: "v4/add-template-pr",
        methods: ["post", "options"],
    },
    {
        name: "submit-analysis-dispatch",
        route: "v4/submit-analysis-dispatch",
        methods: ["post", "options"],
    },
    {
        name: "action-trigger",
        route: "v4/workflow-trigger",
        methods: ["post", "options"],
    },
    {
        name: "action-run-status",
        route: "v4/workflow-run-status",
        methods: ["get", "post", "options"],
    },
    {
        name: "action-run-artifacts",
        route: "v4/workflow-run-artifacts",
        methods: ["get", "post", "options"],
    },
    { name: "setup", route: "v4/setup", methods: ["post", "options"] },
    {
        name: "issue-ai-proxy",
        route: "v4/issue-ai",
        methods: ["post", "options"],
    },
    {
        name: "issue-create",
        route: "v4/issue-create",
        methods: ["post", "options"],
    },
    { name: "repo-fork", route: "v4/repo-fork", methods: ["post", "options"] },
    {
        name: "batch-scan-start",
        route: "v4/batch-scan-start",
        methods: ["post", "options"],
    },
];

functions.forEach((func) => {
    const dir = path.join(__dirname, func.name);
    const functionJson = {
        scriptFile: `../dist/${func.name}.js`,
        entryPoint: "default",
        bindings: [
            {
                authLevel: "anonymous",
                type: "httpTrigger",
                direction: "in",
                name: "req",
                methods: func.methods,
                route: func.route,
            },
            {
                type: "http",
                direction: "out",
                name: "res",
            },
        ],
    };

    // Create directory
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Write function.json
    fs.writeFileSync(
        path.join(dir, "function.json"),
        JSON.stringify(functionJson, null, 2),
    );
    console.log(`Created ${func.name}/function.json`);
});

console.log("\nAll function.json files created!");
