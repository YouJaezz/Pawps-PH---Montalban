import { sql } from "drizzle-orm";

import { db } from "@/db";
import { socialComments, socialPosts } from "@/db/schema";
import { getSocialApiConfig } from "@/lib/social-engagement";

const GRAPH_VERSION = "v21.0";

type SyncResult = {
  ok: boolean;
  facebookPosts: number;
  facebookComments: number;
  tiktokPosts: number;
  errors: string[];
};

type GraphSummary = { total_count?: number };

type GraphPost = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  shares?: { count?: number };
  reactions?: { summary?: GraphSummary };
  comments?: { summary?: GraphSummary };
};

type GraphComment = {
  id: string;
  message?: string;
  created_time?: string;
  like_count?: number;
  permalink_url?: string;
  from?: { name?: string; id?: string };
};

type TikTokVideo = {
  id: string;
  title?: string;
  create_time?: number;
  share_url?: string;
  cover_image_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
};

async function upsertPost(values: typeof socialPosts.$inferInsert) {
  await db
    .insert(socialPosts)
    .values(values)
    .onConflictDoUpdate({
      target: [socialPosts.platform, socialPosts.externalId],
      set: {
        caption: values.caption,
        permalink: values.permalink,
        thumbnailUrl: values.thumbnailUrl,
        publishedAt: values.publishedAt,
        viewCount: values.viewCount,
        likeCount: values.likeCount,
        commentCount: values.commentCount,
        shareCount: values.shareCount,
        reachCount: values.reachCount,
        syncedAt: sql`(unixepoch() * 1000)`,
      },
    });
}

async function upsertComment(values: typeof socialComments.$inferInsert) {
  await db
    .insert(socialComments)
    .values(values)
    .onConflictDoUpdate({
      target: [socialComments.platform, socialComments.externalId],
      set: {
        postExternalId: values.postExternalId,
        authorName: values.authorName,
        authorHandle: values.authorHandle,
        message: values.message,
        likeCount: values.likeCount,
        publishedAt: values.publishedAt,
        permalink: values.permalink,
        isHidden: values.isHidden,
        syncedAt: sql`(unixepoch() * 1000)`,
      },
    });
}

async function syncFacebookPosts(
  pageId: string,
  accessToken: string,
): Promise<{ posts: number; comments: number; errors: string[] }> {
  let posts = 0;
  let comments = 0;
  const errors: string[] = [];

  const fields = [
    "id",
    "message",
    "created_time",
    "permalink_url",
    "full_picture",
    "shares",
    "reactions.limit(0).summary(true)",
    "comments.limit(0).summary(true)",
  ].join(",");

  let nextUrl: string | null =
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/published_posts?fields=${encodeURIComponent(fields)}&limit=25&access_token=${encodeURIComponent(accessToken)}`;

  while (nextUrl) {
    const res = await fetch(nextUrl, { next: { revalidate: 0 } });
    const json = (await res.json()) as {
      data?: GraphPost[];
      paging?: { next?: string };
      error?: { message?: string };
    };

    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? `Facebook API error (${res.status})`);
    }

    for (const post of json.data ?? []) {
      const publishedAt = post.created_time ? new Date(post.created_time) : null;
      await upsertPost({
        platform: "facebook",
        externalId: post.id,
        caption: post.message ?? null,
        permalink: post.permalink_url ?? null,
        thumbnailUrl: post.full_picture ?? null,
        publishedAt,
        viewCount: 0,
        likeCount: post.reactions?.summary?.total_count ?? 0,
        commentCount: post.comments?.summary?.total_count ?? 0,
        shareCount: post.shares?.count ?? 0,
        reachCount: 0,
      });
      posts += 1;

      try {
        let commentUrl: string | null =
          `https://graph.facebook.com/${GRAPH_VERSION}/${post.id}/comments?fields=id,message,created_time,from,like_count,permalink_url&limit=100&access_token=${encodeURIComponent(accessToken)}`;

        while (commentUrl) {
          const commentRes = await fetch(commentUrl, { next: { revalidate: 0 } });
          const commentJson = (await commentRes.json()) as {
            data?: GraphComment[];
            paging?: { next?: string };
            error?: { message?: string };
          };

          if (!commentRes.ok || commentJson.error) {
            throw new Error(
              commentJson.error?.message ??
                `Facebook comments error (${commentRes.status})`,
            );
          }

          for (const comment of commentJson.data ?? []) {
            if (!comment.message?.trim()) continue;
            await upsertComment({
              platform: "facebook",
              externalId: comment.id,
              postExternalId: post.id,
              authorName: comment.from?.name ?? null,
              authorHandle: comment.from?.id ?? null,
              message: comment.message,
              likeCount: comment.like_count ?? 0,
              publishedAt: comment.created_time
                ? new Date(comment.created_time)
                : null,
              permalink: comment.permalink_url ?? null,
              isHidden: false,
            });
            comments += 1;
          }

          commentUrl = commentJson.paging?.next ?? null;
        }
      } catch (err) {
        errors.push(
          `Comments for post ${post.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    nextUrl = json.paging?.next ?? null;
    if (posts >= 100) break;
  }

  return { posts, comments, errors };
}

async function syncTikTokVideos(
  accessToken: string,
): Promise<{ posts: number; errors: string[] }> {
  let posts = 0;
  const errors: string[] = [];

  const res = await fetch("https://open.tiktokapis.com/v2/video/list/?fields=id,title,create_time,share_url,cover_image_url,view_count,like_count,comment_count,share_count", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ max_count: 20 }),
    next: { revalidate: 0 },
  });

  const json = (await res.json()) as {
    data?: { videos?: TikTokVideo[] };
    error?: { message?: string; code?: string };
  };

  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `TikTok API error (${res.status})`);
  }

  for (const video of json.data?.videos ?? []) {
    await upsertPost({
      platform: "tiktok",
      externalId: video.id,
      caption: video.title ?? null,
      permalink: video.share_url ?? null,
      thumbnailUrl: video.cover_image_url ?? null,
      publishedAt: video.create_time ? new Date(video.create_time * 1000) : null,
      viewCount: video.view_count ?? 0,
      likeCount: video.like_count ?? 0,
      commentCount: video.comment_count ?? 0,
      shareCount: video.share_count ?? 0,
      reachCount: 0,
    });
    posts += 1;
  }

  return { posts, errors };
}

export async function syncSocialEngagements(): Promise<SyncResult> {
  const config = getSocialApiConfig();
  const errors: string[] = [];
  let facebookPosts = 0;
  let facebookComments = 0;
  let tiktokPosts = 0;

  if (config.facebook.configured) {
    try {
      const fb = await syncFacebookPosts(
        config.facebook.pageId,
        config.facebook.accessToken,
      );
      facebookPosts = fb.posts;
      facebookComments = fb.comments;
      errors.push(...fb.errors);
    } catch (err) {
      errors.push(
        `Facebook: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (config.tiktok.configured) {
    try {
      const tt = await syncTikTokVideos(config.tiktok.accessToken);
      tiktokPosts = tt.posts;
      errors.push(...tt.errors);
    } catch (err) {
      errors.push(`TikTok: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!config.anyConfigured) {
    return {
      ok: false,
      facebookPosts: 0,
      facebookComments: 0,
      tiktokPosts: 0,
      errors: ["No social API credentials configured."],
    };
  }

  return {
    ok: errors.length === 0,
    facebookPosts,
    facebookComments,
    tiktokPosts,
    errors,
  };
}
