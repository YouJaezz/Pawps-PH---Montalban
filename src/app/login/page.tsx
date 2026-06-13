import { BrandLogo } from "@/components/BrandLogo";
import { LoginForm } from "@/app/login/LoginForm";
import { BRAND_TAGLINE } from "@/lib/brand";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await props.searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-4 text-zinc-900">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg shadow-brand-blue/5">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <div className="mt-3 text-sm text-zinc-600">
            Sign in · {BRAND_TAGLINE}
          </div>
        </div>
        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
