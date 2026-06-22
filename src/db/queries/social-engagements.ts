import { sql } from "drizzle-orm";

import { db } from "@/db";
import {
  socialComments,
  socialPosts,
  type SocialPlatform,
} from "@/db/schema";
import {
  engagementTotal,
  formatSocialDate,
  platformLabel,
  truncateCaption,
} from "@/lib/social-engagement";

export type SocialContentRow = {
  id: number;
  platform: SocialPlatform;
  platformLabel: string;
  caption: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedLabel: string;
  publishedAtMs: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  reachCount: number;
  engagementTotal: number;
  engagementRate: string;
  searchText: string;
};

export type SocialCommentRow = {
  id: number;
  platform: SocialPlatform;
  platformLabel: string;
  postCaption: string;
  postPermalink: string | null;
  authorName: string;
  authorHandle: string | null;
  message: string;
  likeCount: number;
  publishedLabel: string;
  publishedAtMs: number;
  permalink: string | null;
  searchText: string;
};

export type SocialEngagementSummary = {
  postCount: number;
  commentCount: number;
  facebookPosts: number;
  tiktokPosts: number;
  totalViews: number;
  totalEngagement: number;
  commentsLast7Days: number;
  lastSyncedAt: Date | null;
};

function engagementRateLabel(post: {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
}) {
  const engaged = engagementTotal(post);
  if (post.viewCount <= 0) {
    return engaged > 0 ? "—" : "0%";
  }
  return `${((engaged / post.viewCount) * 100).toFixed(1)}%`;
}

export async function getSocialEngagementSummary(): Promise<SocialEngagementSummary> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const [postStats, commentStats, recentComments, lastSync] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)`,
        facebook: sql<number>`sum(case when ${socialPosts.platform} = 'facebook' then 1 else 0 end)`,
        tiktok: sql<number>`sum(case when ${socialPosts.platform} = 'tiktok' then 1 else 0 end)`,
        views: sql<number>`coalesce(sum(${socialPosts.viewCount}), 0)`,
        likes: sql<number>`coalesce(sum(${socialPosts.likeCount}), 0)`,
        comments: sql<number>`coalesce(sum(${socialPosts.commentCount}), 0)`,
        shares: sql<number>`coalesce(sum(${socialPosts.shareCount}), 0)`,
      })
      .from(socialPosts),
    db
      .select({ count: sql<number>`count(*)` })
      .from(socialComments),
    db
      .select({ count: sql<number>`count(*)` })
      .from(socialComments)
      .where(sql`${socialComments.publishedAt} >= ${sevenDaysAgo}`),
    db
      .select({ syncedAt: socialPosts.syncedAt })
      .from(socialPosts)
      .orderBy(sql`${socialPosts.syncedAt} DESC`)
      .limit(1),
  ]);

  const postRow = postStats[0];
  const likes = Number(postRow?.likes ?? 0);
  const comments = Number(postRow?.comments ?? 0);
  const shares = Number(postRow?.shares ?? 0);

  return {
    postCount: Number(postRow?.count ?? 0),
    commentCount: Number(commentStats[0]?.count ?? 0),
    facebookPosts: Number(postRow?.facebook ?? 0),
    tiktokPosts: Number(postRow?.tiktok ?? 0),
    totalViews: Number(postRow?.views ?? 0),
    totalEngagement: likes + comments + shares,
    commentsLast7Days: Number(recentComments[0]?.count ?? 0),
    lastSyncedAt: lastSync[0]?.syncedAt ?? null,
  };
}

export async function getSocialContentRows(): Promise<SocialContentRow[]> {
  const rows = await db
    .select()
    .from(socialPosts)
    .orderBy(sql`coalesce(${socialPosts.publishedAt}, ${socialPosts.syncedAt}) DESC`);

  return rows.map((row) => {
    const caption = truncateCaption(row.caption, 500);
    return {
      id: row.id,
      platform: row.platform,
      platformLabel: platformLabel(row.platform),
      caption,
      permalink: row.permalink,
      thumbnailUrl: row.thumbnailUrl,
      publishedLabel: formatSocialDate(row.publishedAt),
      publishedAtMs: row.publishedAt?.getTime() ?? 0,
      viewCount: row.viewCount,
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      shareCount: row.shareCount,
      reachCount: row.reachCount,
      engagementTotal: engagementTotal(row),
      engagementRate: engagementRateLabel(row),
      searchText: [row.platform, caption, row.permalink].filter(Boolean).join(" "),
    };
  });
}

export async function getSocialCommentRows(): Promise<SocialCommentRow[]> {
  const rows = await db
    .select({
      id: socialComments.id,
      platform: socialComments.platform,
      externalId: socialComments.externalId,
      postExternalId: socialComments.postExternalId,
      authorName: socialComments.authorName,
      authorHandle: socialComments.authorHandle,
      message: socialComments.message,
      likeCount: socialComments.likeCount,
      publishedAt: socialComments.publishedAt,
      permalink: socialComments.permalink,
      postCaption: socialPosts.caption,
      postPermalink: socialPosts.permalink,
    })
    .from(socialComments)
    .leftJoin(
      socialPosts,
      sql`${socialPosts.platform} = ${socialComments.platform} AND ${socialPosts.externalId} = ${socialComments.postExternalId}`,
    )
    .where(sql`${socialComments.isHidden} = 0`)
    .orderBy(sql`coalesce(${socialComments.publishedAt}, ${socialComments.syncedAt}) DESC`);

  return rows.map((row) => {
    const authorName = row.authorName?.trim() || "Unknown";
    const message = row.message.trim();
    const postCaption = truncateCaption(row.postCaption, 80);
    return {
      id: row.id,
      platform: row.platform,
      platformLabel: platformLabel(row.platform),
      postCaption,
      postPermalink: row.postPermalink,
      authorName,
      authorHandle: row.authorHandle,
      message,
      likeCount: row.likeCount,
      publishedLabel: formatSocialDate(row.publishedAt),
      publishedAtMs: row.publishedAt?.getTime() ?? 0,
      permalink: row.permalink,
      searchText: [
        row.platform,
        authorName,
        row.authorHandle,
        message,
        postCaption,
      ]
        .filter(Boolean)
        .join(" "),
    };
  });
}
