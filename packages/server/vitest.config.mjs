import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["src/**/__tests__/**/*.test.{js,ts}"],
        exclude: ["**/node_modules/**", "**/dist/**"],
        environment: "node",
        globals: true,
        watch: false,
        passWithNoTests: false,
        reporters: "basic",
    },
});
