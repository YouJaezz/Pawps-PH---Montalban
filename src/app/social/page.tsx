import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { SocialCommentsTable } from "@/app/social/SocialCommentsTable";
import { SocialContentTable } from "@/app/social/SocialContentTable";
import { SocialPageTabs } from "@/app/social/SocialPageTabs";
import { SocialSetupBanner } from "@/app/social/SocialSetupBanner";
import {
  SocialSyncButton,
} from "@/app/social/SocialSyncButton";
import {
  getSocialCommentRows,
  getSocialContentRows,
  getSocialEngagementSummary,
} from "@/db/queries/social-engagements";
import { requireAdmin } from "@/lib/auth-guard";
import {
  formatCount,
  formatLastSynced,
  getSocialApiConfig,
} from "@/lib/social-engagement";

export const dynamic = "force-dynamic";

export default async function SocialPage(props: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const sp = await props.searchParams;
  const activeTab = sp.tab === "comments" ? "comments" : "content";
  const config = getSocialApiConfig();

  const [summary, contentRows, commentRows] = await Promise.all([
    getSocialEngagementSummary(),
    getSocialContentRows(),
    getSocialCommentRows(),
  ]);

  return (
    <AppShell>
      <div className="w-full px-0 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm text-zinc-400">Social</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              TikTok & Facebook Engagements
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Track content performance and comments across your Facebook Page and
              TikTok account in one place.
            </p>
          </div>
          <SocialSyncButton
            config={config}
            lastSyncedLabel={formatLastSynced(summary.lastSyncedAt)}
          />
        </div>

        <SocialSetupBanner config={config} />

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Synced posts"
            value={`${summary.postCount}`}
            subtitle={`${summary.facebookPosts} Facebook · ${summary.tiktokPosts} TikTok`}
          />
          <StatCard
            title="Total views"
            value={formatCount(summary.totalViews)}
            subtitle="Across synced TikTok & Facebook content"
          />
          <StatCard
            title="Total engagement"
            value={formatCount(summary.totalEngagement)}
            subtitle="Likes + comments + shares on posts"
          />
          <StatCard
            title="Comments (7 days)"
            value={`${summary.commentsLast7Days}`}
            subtitle={`${summary.commentCount} total synced comments`}
          />
        </div>

        <div className="mt-8">
          <SocialPageTabs activeTab={activeTab} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
          {activeTab === "content" ? (
            <>
              <div className="text-sm font-medium text-zinc-200">
                Content Performance
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Views, likes, comments, and shares per post or video.
              </p>
              <SocialContentTable rows={contentRows} />
            </>
          ) : (
            <>
              <div className="text-sm font-medium text-zinc-200">Comments</div>
              <p className="mt-1 text-xs text-zinc-500">
                Recent audience comments synced from Facebook posts.
              </p>
              <SocialCommentsTable rows={commentRows} />
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
