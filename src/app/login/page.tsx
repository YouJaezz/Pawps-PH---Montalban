import { LoginForm } from "@/app/login/LoginForm";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await props.searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#07070a] px-4 text-zinc-50">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="mb-6 text-center">
          <div className="text-lg font-semibold tracking-tight">
            Pet Pro Manager
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            Sign in to manage inventory &amp; sales
          </div>
        </div>
        <LoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
