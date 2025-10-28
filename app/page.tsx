"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace("/chat"), 800);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="relative flex min-h-screen items-center justify-center font-sans">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_circle_at_50%_-200px,rgba(59,130,246,0.18),transparent_60%),radial-gradient(800px_circle_at_0%_100%,rgba(16,185,129,0.15),transparent_50%)] dark:bg-[radial-gradient(1200px_circle_at_50%_-200px,rgba(59,130,246,0.22),transparent_60%),radial-gradient(800px_circle_at_0%_100%,rgba(16,185,129,0.2),transparent_50%)]" />
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-zinc-200/80 bg-white/70 p-8 text-center shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/60 dark:supports-[backdrop-filter]:bg-zinc-900/50">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7" width="18" height="13" rx="4"/>
            <path d="M7 7V5a5 5 0 0 1 10 0v2"/>
            <circle cx="9" cy="13" r="1.5"/>
            <circle cx="15" cy="13" r="1.5"/>
          </svg>
        </div>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
        <div>
          <h1 className="text-lg font-semibold">Đang khởi động Chatbot…</h1>
          <p className="mt-1 text-sm text-zinc-500">Sẽ chuyển sang phòng chat ngay bây giờ</p>
        </div>
      </div>
    </div>
  );
}
