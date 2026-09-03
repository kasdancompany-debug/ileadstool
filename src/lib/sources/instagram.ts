// Instagram Graph API client (requires a Meta Business app + long-lived Page access
// token with `instagram_basic` + `instagram_manage_insights` scopes on the connected
// IG Business account). Set:
//   IG_BUSINESS_ACCOUNT_ID=17841...
//   IG_ACCESS_TOKEN=EAAG...
// This can't be set up on your behalf — it needs your Meta Business login.
const IG_ACCOUNT_ID = process.env.IG_BUSINESS_ACCOUNT_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;

export const instagramConfigured = Boolean(IG_ACCOUNT_ID && IG_ACCESS_TOKEN);

export interface InstagramStats {
  followers: number;
  viewsThisMonth: number;
  postCountThisMonth: number;
  topPost: {
    caption: string;
    permalink: string;
    views: number;
    likes: number;
    comments: number;
  } | null;
}

export async function fetchInstagramStats(monthStart: Date, asOf: Date): Promise<InstagramStats> {
  if (!instagramConfigured) throw new Error("Instagram not configured");

  const sinceUnix = Math.floor(monthStart.getTime() / 1000);
  const untilUnix = Math.floor(
    new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 23, 59, 59).getTime() / 1000
  );

  const profileRes = await fetch(
    `https://graph.facebook.com/v21.0/${IG_ACCOUNT_ID}?fields=followers_count&access_token=${IG_ACCESS_TOKEN}`,
    { cache: "no-store" }
  );
  if (!profileRes.ok) throw new Error(`Instagram profile fetch failed: ${profileRes.status}`);
  const profile = await profileRes.json();

  const mediaRes = await fetch(
    `https://graph.facebook.com/v21.0/${IG_ACCOUNT_ID}/media?fields=caption,permalink,timestamp,like_count,comments_count,insights.metric(views)&since=${sinceUnix}&until=${untilUnix}&limit=100&access_token=${IG_ACCESS_TOKEN}`,
    { cache: "no-store" }
  );
  if (!mediaRes.ok) throw new Error(`Instagram media fetch failed: ${mediaRes.status}`);
  const media = await mediaRes.json();

  let topPost: InstagramStats["topPost"] = null;
  let totalViews = 0;
  const mediaData = media.data ?? [];
  for (const item of mediaData) {
    const views = Number(
      item.insights?.data?.find((m: { name: string }) => m.name === "views")?.values?.[0]?.value ?? 0
    );
    totalViews += views;
    if (!topPost || views > topPost.views) {
      topPost = {
        caption: item.caption ?? "",
        permalink: item.permalink,
        views,
        likes: Number(item.like_count ?? 0),
        comments: Number(item.comments_count ?? 0),
      };
    }
  }

  return {
    followers: Number(profile.followers_count ?? 0),
    viewsThisMonth: totalViews,
    postCountThisMonth: mediaData.length,
    topPost,
  };
}
