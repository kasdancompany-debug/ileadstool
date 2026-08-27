// Facebook Page Graph API client. Reuses the same Page access token as Instagram
// (IG_ACCESS_TOKEN is actually a Facebook Page token under the hood, and a Page's
// token works for both its own Graph API and its linked IG Business account). Set:
//   FB_PAGE_ID=<page id, e.g. 170006466376732>
//
// "Top post" is ranked by engagement (reactions + comments + shares), not views —
// Meta has deprecated organic post-impression metrics (post_impressions etc.) for
// most apps, so there's no reliable view count to rank by even with read_insights.
// Reading /posts at all needs the `pages_read_user_content` permission on top of
// `pages_read_engagement`. See src/lib/sources/instagram.ts for the IG equivalent.
const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;

export const facebookConfigured = Boolean(FB_PAGE_ID && FB_ACCESS_TOKEN);

export interface FacebookStats {
  followers: number;
  engagementThisMonth: number;
  postCountThisMonth: number;
  likesThisMonth: number;
  commentsThisMonth: number;
  sharesThisMonth: number;
  topPost: {
    message: string;
    permalink: string;
    engagement: number;
    likes: number;
    comments: number;
    shares: number;
  } | null;
}

interface FacebookPost {
  message?: string;
  permalink_url: string;
  shares?: { count: number };
  reactions?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
}

export async function fetchFacebookStats(): Promise<FacebookStats> {
  if (!facebookConfigured) throw new Error("Facebook not configured");

  const now = new Date();
  const monthStart = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
  const nowUnix = Math.floor(now.getTime() / 1000);

  const profileRes = await fetch(
    `https://graph.facebook.com/v21.0/${FB_PAGE_ID}?fields=fan_count&access_token=${FB_ACCESS_TOKEN}`,
    { cache: "no-store" }
  );
  if (!profileRes.ok) throw new Error(`Facebook page fetch failed: ${profileRes.status}`);
  const profile = await profileRes.json();

  const postsRes = await fetch(
    `https://graph.facebook.com/v21.0/${FB_PAGE_ID}/posts?fields=message,permalink_url,shares,reactions.summary(true),comments.summary(true)&since=${monthStart}&until=${nowUnix}&limit=100&access_token=${FB_ACCESS_TOKEN}`,
    { cache: "no-store" }
  );
  if (!postsRes.ok) throw new Error(`Facebook posts fetch failed: ${postsRes.status}`);
  const posts = await postsRes.json();

  let topPost: FacebookStats["topPost"] = null;
  let totalEngagement = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  const postsData = (posts.data ?? []) as FacebookPost[];
  for (const item of postsData) {
    const likes = item.reactions?.summary.total_count ?? 0;
    const comments = item.comments?.summary.total_count ?? 0;
    const shares = item.shares?.count ?? 0;
    const engagement = likes + comments + shares;
    totalEngagement += engagement;
    totalLikes += likes;
    totalComments += comments;
    totalShares += shares;
    if (!topPost || engagement > topPost.engagement) {
      topPost = { message: item.message ?? "", permalink: item.permalink_url, engagement, likes, comments, shares };
    }
  }

  return {
    followers: Number(profile.fan_count ?? 0),
    engagementThisMonth: totalEngagement,
    postCountThisMonth: postsData.length,
    likesThisMonth: totalLikes,
    commentsThisMonth: totalComments,
    sharesThisMonth: totalShares,
    topPost,
  };
}
