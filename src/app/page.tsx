'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import Button from '@/components/ui/Button';
import WatchItemList from '@/components/watch/WatchItemList';

export default function Home() {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-sky-50">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-xl shadow-md shadow-amber-200">
              ✈️
            </div>
            <h1 className="text-xl font-extrabold text-slate-800">Travel Helper</h1>
          </div>
          {user ? (
            <Button variant="ghost" size="sm" onClick={logout}>로그아웃</Button>
          ) : (
            <div className="flex gap-2">
              <Link href="/login"><Button size="sm">로그인</Button></Link>
              <Link href="/signup"><Button size="sm" variant="outline">회원가입</Button></Link>
            </div>
          )}
        </div>

        {/* 본문 */}
        {user ? (
          <>
            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-700">관심 여행지</h2>
              <Link href="/watch/new">
                <Button size="sm">+ 등록</Button>
              </Link>
            </div>
            <WatchItemList />
          </>
        ) : (
          <div className="mt-20 text-center">
            <p className="text-slate-500">로그인하고 관심 여행지를 등록해보세요.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/login"><Button size="lg">로그인</Button></Link>
              <Link href="/signup"><Button size="lg" variant="outline">회원가입</Button></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
