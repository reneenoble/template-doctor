import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/unit/**/*.spec.{js,ts}"],
        exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/legacy-api/**", // Exclude legacy API tests
        ],
        environment: "node",
        globals: true,
        watch: false,
        passWithNoTests: false,
        reporters: "basic",
    },
});
