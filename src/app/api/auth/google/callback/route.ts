import { NextResponse } from "next/server";
import { upsertEnvVars } from "@/lib/envFile";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface AccountSummary {
  account: string;
  displayName: string;
  propertySummaries?: { property: string; displayName: string }[];
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

  if (error) return html(`<h1>Google sign-in cancelled</h1><p>${error}</p>`);
  if (!code) return html(`<h1>Missing code</h1><p>No authorization code in callback.</p>`);

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI!;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return html(`<h1>Token exchange failed</h1><pre>${await tokenRes.text()}</pre>`);
  }

  const tokens = (await tokenRes.json()) as TokenResponse;

  if (!tokens.refresh_token) {
    return html(
      `<h1>No refresh token returned</h1><p>Google only issues a refresh token on the first consent for an app. Revoke access at <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a> for "iLeads Dashboard" and try again.</p>`
    );
  }

  await upsertEnvVars({ GOOGLE_REFRESH_TOKEN: tokens.refresh_token });

  // Try to auto-discover the GA4 property so you don't have to hunt for the ID.
  let propertyListHtml = "";
  try {
    const summaryRes = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (summaryRes.ok) {
      const data = (await summaryRes.json()) as { accountSummaries?: AccountSummary[] };
      const properties = (data.accountSummaries ?? []).flatMap((acc) =>
        (acc.propertySummaries ?? []).map((p) => ({
          id: p.property.replace("properties/", ""),
          name: p.displayName,
          account: acc.displayName,
        }))
      );

      if (properties.length === 1) {
        await upsertEnvVars({ GA4_PROPERTY_ID: properties[0].id });
        propertyListHtml = `<p>Auto-detected and saved GA4 property: <b>${properties[0].name}</b> (${properties[0].id})</p>`;
      } else if (properties.length > 1) {
        propertyListHtml = `<p>Found multiple GA4 properties — tell your assistant which one is Sault Nissan's:</p><ul>${properties
          .map((p) => `<li>${p.name} — account "${p.account}" — id <code>${p.id}</code></li>`)
          .join("")}</ul>`;
      } else {
        propertyListHtml = `<p>No GA4 properties found on this account. Set <code>GA4_PROPERTY_ID</code> manually.</p>`;
      }
    } else {
      propertyListHtml = `<p>Couldn't auto-detect the property (Analytics Admin API may not be enabled) — set <code>GA4_PROPERTY_ID</code> manually in .env.local.</p>`;
    }
  } catch {
    propertyListHtml = `<p>Couldn't auto-detect the property — set <code>GA4_PROPERTY_ID</code> manually in .env.local.</p>`;
  }

  return html(
    `<h1>Connected</h1><p>Refresh token saved to .env.local.</p>${propertyListHtml}<p>Restart the dev server to pick up the new values.</p>`
  );
}
