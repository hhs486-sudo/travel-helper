'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handleGoogleCallback = useAuthStore((s) => s.handleGoogleCallback);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const savedState = sessionStorage.getItem('oauth_state');

    if (!code || !state) {
      router.replace('/?error=oauth_missing_params');
      return;
    }

    if (state !== savedState) {
      router.replace('/?error=oauth_state_mismatch');
      return;
    }

    sessionStorage.removeItem('oauth_state');

    const redirectUri = `${window.location.origin}/auth/callback/google`;

    handleGoogleCallback(code, state, redirectUri)
      .then(() => router.replace('/'))
      .catch(() => router.replace('/?error=oauth_failed'));
  }, [searchParams, handleGoogleCallback, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <p className="text-zinc-500 dark:text-zinc-400">Google 로그인 처리 중...</p>
    </div>
  );
}
