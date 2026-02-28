'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import Button from '@/components/ui/Button';

export default function Home() {
  const { user, logout } = useAuthStore();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-sky-50 px-4">
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-3xl shadow-lg shadow-amber-200">
          ✈️
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-slate-800">Travel Helper</h1>
        <p className="mt-2 text-slate-500">관심 여행지를 등록하고 가격 변동을 알림받아요.</p>

        <div className="mt-8 flex flex-col items-center gap-3">
          {user ? (
            <>
              <Link href="/watch/new">
                <Button size="lg">+ 관심 여행지 등록</Button>
              </Link>
              <Button variant="ghost" size="md" onClick={logout}>
                로그아웃
              </Button>
            </>
          ) : (
            <div className="flex gap-3">
              <Link href="/login">
                <Button size="lg">로그인</Button>
              </Link>
              <Link href="/signup">
                <Button size="lg" variant="outline">회원가입</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
