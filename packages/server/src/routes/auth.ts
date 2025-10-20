import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const authRouter = Router();

// GitHub OAuth token exchange
authRouter.post('/github-oauth-token', async (req: Request, res: Response) => {
  const requestId = uuidv4();

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const code = body.code;

    if (!code) {
      return res.status(400).json({ error: 'Missing code', requestId });
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'Server not configured for GitHub OAuth',
        requestId,
      });
    }

    // Exchange code for token with GitHub
    const ghRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const data = await ghRes.json();

    console.log('GitHub OAuth response', {
      requestId,
      status: ghRes.status,
      hasError: !!data.error,
    });

    if (!ghRes.ok) {
      return res.status(ghRes.status).json({
        error: data.error_description || data.error || 'OAuth exchange failed',
        requestId,
      });
    }

    if (data.error) {
      return res.status(400).json({
        error: data.error_description || data.error,
        requestId,
      });
    }

    if (!data.access_token) {
      return res.status(502).json({
        error: 'No access_token in GitHub response',
        requestId,
      });
    }

    return res.status(200).json({
      access_token: data.access_token,
      scope: data.scope || null,
      token_type: data.token_type || 'bearer',
      requestId,
    });
  } catch (err: any) {
    console.error('GitHub OAuth exchange exception', {
      requestId,
      error: err?.message,
    });
    return res.status(500).json({
      error: 'Internal error during token exchange',
      requestId,
    });
  }
});
