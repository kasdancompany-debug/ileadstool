import { randomBytes, createHash } from "crypto";
import { NextResponse } from "next/server";
import { BKD_AUTHORIZATION_ENDPOINT } from "@/lib/sources/bkd";

// One-time OAuth flow: visit this route while logged into the BKD.ai account for
// Sault Nissan (marketing@saultnissan.ca). The MCP endpoint is a full OAuth2
// resource server (see .well-known/oauth-protected-resource) — offline_access
// scope gets us a refresh_token back, not just a short-lived access token. PKCE
// (S256) is required by this server; the verifier rides in a short-lived cookie
// until the callback exchanges it.
export async function GET() {
  const clientId = process.env.BKD_OAUTH_CLIENT_ID;
  const redirectUri = process.env.BKD_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "BKD OAuth client not configured" }, { status: 500 });
  }

  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const url = new URL(BKD_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email offline_access");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("bkd_pkce_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/auth/bkd",
  });
  return res;
}
