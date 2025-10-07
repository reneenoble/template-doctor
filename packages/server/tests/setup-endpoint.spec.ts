/**
 * Setup Endpoint Tests
 * Tests GET/POST /api/v4/setup with Git CSV persistence
 */

import fs from "fs/promises";
import path from "path";

const CONFIG_FILE = path.join(process.cwd(), "config", "overrides.csv");

describe("Setup Endpoint - Git CSV Persistence", () => {
    beforeEach(async () => {
        // Clean up any existing config file
        try {
            await fs.unlink(CONFIG_FILE);
        } catch (err: any) {
            if (err.code !== "ENOENT") throw err;
        }
    });

    it("should return empty overrides when CSV does not exist (GET)", async () => {
        const response = await fetch("http://localhost:3001/api/v4/setup");
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.overrides).toEqual({});
        expect(data.count).toBe(0);
        expect(data.message).toContain("No configuration overrides found");
    });

    it("should reject unauthorized users (POST)", async () => {
        const response = await fetch("http://localhost:3001/api/v4/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user: "unauthorized-user",
                overrides: { testKey: "testValue" },
            }),
        });

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toContain("Unauthorized");
    });

    it("should save and load configuration overrides (POST + GET)", async () => {
        // Set SETUP_ALLOWED_USERS for test
        const originalEnv = process.env.SETUP_ALLOWED_USERS;
        process.env.SETUP_ALLOWED_USERS = "test-user,admin";

        try {
            // Save overrides
            const postResponse = await fetch(
                "http://localhost:3001/api/v4/setup",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user: "test-user",
                        overrides: {
                            feature1: "enabled",
                            timeout: "5000",
                        },
                    }),
                },
            );

            expect(postResponse.status).toBe(200);
            const postData = await postResponse.json();
            expect(postData.ok).toBe(true);
            expect(postData.applied).toBe(2);

            // Verify CSV was created
            const csvExists = await fs
                .access(CONFIG_FILE)
                .then(() => true)
                .catch(() => false);
            expect(csvExists).toBe(true);

            // Load overrides
            const getResponse = await fetch(
                "http://localhost:3001/api/v4/setup",
            );
            const getData = await getResponse.json();

            expect(getData.overrides.feature1).toBe("enabled");
            expect(getData.overrides.timeout).toBe("5000");
            expect(getData.count).toBe(2);
            expect(getData.metadata).toHaveLength(2);

            // Verify metadata includes user and timestamp
            const feature1Meta = getData.metadata.find(
                (m: any) => m.key === "feature1",
            );
            expect(feature1Meta.updatedBy).toBe("test-user");
            expect(feature1Meta.updatedAt).toBeTruthy();
        } finally {
            process.env.SETUP_ALLOWED_USERS = originalEnv;
        }
    });

    it("should update existing overrides (POST)", async () => {
        process.env.SETUP_ALLOWED_USERS = "admin";

        try {
            // Create initial overrides
            await fetch("http://localhost:3001/api/v4/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user: "admin",
                    overrides: { key1: "value1", key2: "value2" },
                }),
            });

            // Update one key, add a new one
            await fetch("http://localhost:3001/api/v4/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user: "admin",
                    overrides: { key1: "updated-value1", key3: "value3" },
                }),
            });

            // Verify final state
            const response = await fetch("http://localhost:3001/api/v4/setup");
            const data = await response.json();

            expect(data.overrides.key1).toBe("updated-value1");
            expect(data.overrides.key2).toBe("value2");
            expect(data.overrides.key3).toBe("value3");
            expect(data.count).toBe(3);
        } finally {
            delete process.env.SETUP_ALLOWED_USERS;
        }
    });

    it("should delete overrides when value is null (POST)", async () => {
        process.env.SETUP_ALLOWED_USERS = "admin";

        try {
            // Create overrides
            await fetch("http://localhost:3001/api/v4/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user: "admin",
                    overrides: {
                        key1: "value1",
                        key2: "value2",
                        key3: "value3",
                    },
                }),
            });

            // Delete key2
            await fetch("http://localhost:3001/api/v4/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user: "admin",
                    overrides: { key2: null },
                }),
            });

            // Verify deletion
            const response = await fetch("http://localhost:3001/api/v4/setup");
            const data = await response.json();

            expect(data.overrides.key1).toBe("value1");
            expect(data.overrides.key2).toBeUndefined();
            expect(data.overrides.key3).toBe("value3");
            expect(data.count).toBe(2);
        } finally {
            delete process.env.SETUP_ALLOWED_USERS;
        }
    });

    it("should handle CSV values with commas and quotes", async () => {
        process.env.SETUP_ALLOWED_USERS = "admin";

        try {
            await fetch("http://localhost:3001/api/v4/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user: "admin",
                    overrides: {
                        description: "This value has, commas",
                        quoted: 'Value with "quotes" inside',
                        both: 'Has, commas and "quotes"',
                    },
                }),
            });

            const response = await fetch("http://localhost:3001/api/v4/setup");
            const data = await response.json();

            expect(data.overrides.description).toBe("This value has, commas");
            expect(data.overrides.quoted).toBe('Value with "quotes" inside');
            expect(data.overrides.both).toBe('Has, commas and "quotes"');
        } finally {
            delete process.env.SETUP_ALLOWED_USERS;
        }
    });
});
