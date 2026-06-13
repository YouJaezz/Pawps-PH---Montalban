import { LiveTrackView } from "@/app/track/[token]/LiveTrackView";
import { BRAND_NAME } from "@/lib/brand";

export default async function PublicTrackPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  return (
    <div className="min-h-dvh bg-[#000000] text-zinc-900">
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="text-xs text-zinc-600">{BRAND_NAME} · Live tracking</div>
        <LiveTrackView token={token} />
      </div>
    </div>
  );
}
