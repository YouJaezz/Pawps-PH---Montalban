import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth-guard";
import { getSocialApiConfig } from "@/lib/social-engagement";
import { syncSocialEngagements } from "@/lib/social-sync";

export async function POST() {
  await requireAdmin();

  const config = getSocialApiConfig();
  if (!config.anyConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Add Facebook or TikTok API credentials in Vercel environment variables first.",
      },
      { status: 400 },
    );
  }

  const result = await syncSocialEngagements();
  revalidatePath("/social");

  return NextResponse.json({
    ok: result.ok,
    facebookPosts: result.facebookPosts,
    facebookComments: result.facebookComments,
    tiktokPosts: result.tiktokPosts,
    errors: result.errors,
  });
}
