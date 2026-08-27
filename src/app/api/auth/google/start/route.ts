import { NextResponse } from "next/server";

// One-time-per-token OAuth flow: visit this route while logged into the Google
// account that has access to Sault Nissan's GA4 property (marketing@saultnissan.ca).
// access_type=offline + prompt=consent forces Google to hand back a refresh_token,
// not just a short-lived access token.
export async function GET() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Google OAuth client not configured" }, { status: 500 });
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/analytics.readonly");

  return NextResponse.redirect(url.toString());
}
