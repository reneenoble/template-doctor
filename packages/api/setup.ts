import { HttpRequest, Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";

// Minimal stub implementation – always succeeds (legacy script expects 200).
export const handler = wrapHttp(async (req: HttpRequest, _ctx: Context) => {
    if (req.method === "OPTIONS") return { status: 204 };
    if (req.method !== "POST")
        return { status: 405, body: { error: "Method not allowed" } };
    return {
        status: 200,
        body: {
            ok: true,
            message: "Setup stub (no overrides applied)",
            timestamp: new Date().toISOString(),
        },
    };
});

export default handler;
