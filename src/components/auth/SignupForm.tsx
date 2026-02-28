'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { bkend } from '@/lib/bkend';
import Button from '@/components/ui/Button';

export default function SignupForm() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    const pwPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/;
    if (password.length < 8 || !pwPattern.test(password)) {
      setError('비밀번호는 8자 이상, 대/소문자·숫자·특수문자(!@#$%^&*)를 포함해야 합니다.');
      return;
    }

    setIsLoading(true);
    try {
      await bkend.auth.signup({ name, email, password });
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-sky-50 px-4">
      <div className="w-full max-w-sm">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-2xl shadow-lg shadow-amber-200">
            ✈️
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-800">Travel Helper</h1>
          <p className="mt-1 text-sm text-slate-500">여행을 시작해볼까요?</p>
        </div>

        {/* 카드 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-extrabold text-slate-800">회원가입</h2>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <span className="text-red-400">⚠️</span>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">이름</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">이메일</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">비밀번호</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="대/소문자+숫자+특수문자 포함 8자 이상"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">비밀번호 확인</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <Button type="submit" size="lg" fullWidth isLoading={isLoading} className="mt-1">
              회원가입
            </Button>
          </form>
        </div>

        {/* 하단 링크 */}
        <p className="mt-4 text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-semibold text-amber-600 hover:text-amber-700">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
