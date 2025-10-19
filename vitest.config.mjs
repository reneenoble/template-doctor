import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: [
            "tests/unit/**/*.spec.{js,ts}",            // Root unit tests (frontend - needs jsdom)
            "packages/server/tests/**/*.test.{js,ts}", // Server service tests (needs node)
            "packages/server/tests/**/*.spec.{js,ts}", // Allow spec naming in server
        ],
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/legacy-api/**", // Exclude legacy API tests
        ],
        environment: "jsdom", // Frontend tests need DOM, server tests will override if needed
        globals: true,
        watch: false,
        passWithNoTests: false,
        reporters: "basic",
    },
});
