import type { SocialPlatform } from "@/db/schema";

export type SocialApiConfig = {
  facebook: {
    pageId: string;
    accessToken: string;
    configured: boolean;
  };
  tiktok: {
    accessToken: string;
    openId: string;
    configured: boolean;
  };
  anyConfigured: boolean;
};

export function getSocialApiConfig(): SocialApiConfig {
  const facebookPageId = process.env.FACEBOOK_PAGE_ID?.trim() ?? "";
  const facebookToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim() ?? "";
  const tiktokToken = process.env.TIKTOK_ACCESS_TOKEN?.trim() ?? "";
  const tiktokOpenId = process.env.TIKTOK_OPEN_ID?.trim() ?? "";

  const facebook = {
    pageId: facebookPageId,
    accessToken: facebookToken,
    configured: facebookPageId.length > 0 && facebookToken.length > 0,
  };
  const tiktok = {
    accessToken: tiktokToken,
    openId: tiktokOpenId,
    configured: tiktokToken.length > 0,
  };

  return {
    facebook,
    tiktok,
    anyConfigured: facebook.configured || tiktok.configured,
  };
}

export function platformLabel(platform: SocialPlatform) {
  return platform === "facebook" ? "Facebook" : "TikTok";
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("en-PH", { notation: "compact" }).format(value);
}

export function formatSocialDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatLastSynced(d: Date | null) {
  if (!d) return "Never";
  return formatSocialDate(d);
}

export function engagementTotal(post: {
  likeCount: number;
  commentCount: number;
  shareCount: number;
}) {
  return post.likeCount + post.commentCount + post.shareCount;
}

export function engagementRate(post: {
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

export function truncateCaption(text: string | null | undefined, max = 120) {
  const raw = text?.trim() ?? "";
  if (!raw) return "—";
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1)}…`;
}
