import type { SocialApiConfig } from "@/lib/social-engagement";

export function SocialSetupBanner(props: { config: SocialApiConfig }) {
  if (props.config.anyConfigured) return null;

  return (
    <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
      <div className="text-sm font-medium text-amber-100">
        Connect Facebook & TikTok to sync engagements
      </div>
      <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
        Add these environment variables in Vercel (Settings → Environment
        Variables), then use <strong>Sync now</strong> on this page.
      </p>
      <ul className="mt-3 space-y-1.5 text-xs text-amber-100/90">
        <li>
          <code className="rounded bg-black/30 px-1.5 py-0.5">FACEBOOK_PAGE_ID</code>{" "}
          — your Facebook Page numeric ID
        </li>
        <li>
          <code className="rounded bg-black/30 px-1.5 py-0.5">FACEBOOK_PAGE_ACCESS_TOKEN</code>{" "}
          — Page access token with{" "}
          <code className="rounded bg-black/20 px-1">pages_read_engagement</code>
        </li>
        <li>
          <code className="rounded bg-black/30 px-1.5 py-0.5">TIKTOK_ACCESS_TOKEN</code>{" "}
          — optional TikTok user access token (Display API)
        </li>
      </ul>
    </div>
  );
}
