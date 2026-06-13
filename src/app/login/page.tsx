import { BrandLogo } from "@/components/BrandLogo";
import { LoginForm } from "@/app/login/LoginForm";
import { BRAND_TAGLINE } from "@/lib/brand";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await props.searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#07070a] px-4 text-zinc-50">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <div className="mt-3 text-xs text-zinc-400">
            Sign in · {BRAND_TAGLINE}
          </div>
        </div>
        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
