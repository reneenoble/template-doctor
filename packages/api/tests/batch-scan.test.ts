import { describe, it, expect } from "vitest";
import {
    batchScanStartHandler,
    batchScanStatusHandler,
} from "../src/functions/batch-scan-start.js";
import { HttpRequest } from "@azure/functions";

function post(body: any): HttpRequest {
    return { method: "POST", json: async () => body } as any;
}
function get(query: Record<string, string>): HttpRequest {
    const m = new Map<string, string>(Object.entries(query));
    return { method: "GET", query: m } as any;
}
const ctx: any = { log: () => {} };

describe("batch scan functions", () => {
    it("rejects invalid body", async () => {
        const res = await batchScanStartHandler(post({}), ctx);
        expect(res.status).toBe(400);
    });
    it("starts and queries status", async () => {
        const start = await batchScanStartHandler(
            post({ repos: ["a/b", "a/b", "c/d"] }),
            ctx,
        );
        expect(start.status).toBe(202);
        const { batchId } = start.jsonBody as any;
        expect(batchId).toBeTruthy();
        // Allow a microtask tick to ensure batch store mutation is visible (though synchronous now, defensive for future async changes)
        await Promise.resolve();
        const status = await batchScanStatusHandler(get({ batchId }), ctx);
        expect(status.status).toBe(200);
    });
});
