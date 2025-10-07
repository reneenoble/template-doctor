import { wrapHttp } from "./shared/http";
import type { HttpRequest, Context } from "@azure/functions";

// LEGACY CODE - MIGRATED TO EXPRESS
// This Azure Functions endpoint has been fully migrated to Express.
// See packages/server/src/routes/validation.ts for the current implementation.
// This file is preserved for reference only.

export const handler = wrapHttp(async (req: HttpRequest, ctx: Context) => {
    // LEGACY: This Azure Function has been migrated to Express.
    // Use POST /api/v4/validation-docker-image on the Express server instead.
    // See packages/server/src/routes/validation.ts for the current implementation.
    return {
        status: 410, // Gone
        body: {
            error: "This endpoint has been migrated to Express server",
            message:
                "Please use POST /api/v4/validation-docker-image on the Express backend instead",
            migration: "packages/server/src/routes/validation.ts",
        },
    };
});

export default handler;
