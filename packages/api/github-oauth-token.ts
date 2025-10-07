import { Context } from "@azure/functions";
import { wrapHttp } from "./shared/http";
import { loadEnv } from "./shared/env";

export default wrapHttp(async (req: any, ctx: Context, requestId: string) => {
    const env = loadEnv();
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const code = body.code;
    if (!code) {
        return { status: 400, body: { error: "Missing code", requestId } };
    }
    const clientId = env.GITHUB_CLIENT_ID;
    const clientSecret = env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        return {
            status: 500,
            body: {
                error: "Server not configured for GitHub OAuth",
                requestId,
            },
        };
    }
    try {
        const ghRes = await fetch(
            "https://github.com/login/oauth/access_token",
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                }),
            },
        );
        const data = await ghRes.json();
        ctx.log("GitHub OAuth response", {
            requestId,
            status: ghRes.status,
            hasError: !!data.error,
        });
        if (!ghRes.ok) {
            return {
                status: ghRes.status,
                body: {
                    error:
                        data.error_description ||
                        data.error ||
                        "OAuth exchange failed",
                    requestId,
                },
            };
        }
        if (data.error) {
            return {
                status: 400,
                body: {
                    error: data.error_description || data.error,
                    requestId,
                },
            };
        }
        if (!data.access_token) {
            return {
                status: 502,
                body: {
                    error: "No access_token in GitHub response",
                    requestId,
                },
            };
        }
        return {
            status: 200,
            body: {
                access_token: data.access_token,
                scope: data.scope || null,
                token_type: data.token_type || "bearer",
                requestId,
            },
        };
    } catch (err: any) {
        ctx.log.error("GitHub OAuth exchange exception", {
            requestId,
            error: err?.message,
        });
        return {
            status: 500,
            body: { error: "Internal error during token exchange", requestId },
        };
    }
});
