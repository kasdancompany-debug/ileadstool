import { NextResponse } from "next/server";
import { upsertEnvVars } from "@/lib/envFile";
import { BKD_TOKEN_ENDPOINT } from "@/lib/sources/bkd";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

function html(body: string) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;max-width:640px;margin:60px auto;line-height:1.5">${body}</body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) return html(`<h1>BKD sign-in cancelled</h1><p>${error}</p>`);
  if (!code) return html(`<h1>Missing code</h1><p>No authorization code in callback.</p>`);

  const codeVerifier = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("bkd_pkce_verifier="))
    ?.split("=")[1];

  if (!codeVerifier) {
    return html(`<h1>Missing PKCE verifier</h1><p>The setup cookie expired — start over at <a href="/api/auth/bkd/start">/api/auth/bkd/start</a>.</p>`);
  }

  const clientId = process.env.BKD_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.BKD_OAUTH_CLIENT_SECRET!;
  const redirectUri = process.env.BKD_OAUTH_REDIRECT_URI!;

  const tokenRes = await fetch(BKD_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    return html(`<h1>Token exchange failed</h1><pre>${await tokenRes.text()}</pre>`);
  }

  const tokens = (await tokenRes.json()) as TokenResponse;

  if (!tokens.refresh_token) {
    return html(
      `<h1>No refresh token returned</h1><p>Make sure the "offline_access" scope was granted, then try again.</p>`
    );
  }

  await upsertEnvVars({ BKD_REFRESH_TOKEN: tokens.refresh_token });

  const res = html(
    `<h1>Connected</h1><p>Refresh token saved to .env.local.</p><p>Restart the dev server to pick up the new value — the dashboard's lead source numbers should switch to live BKD data.</p>`
  );
  res.cookies.delete("bkd_pkce_verifier");
  return res;
}
