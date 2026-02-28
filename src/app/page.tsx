import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-white to-sky-50 px-4">
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-3xl shadow-lg shadow-amber-200">
          ✈️
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-slate-800">Travel Helper</h1>
        <p className="mt-2 text-slate-500">관심 여행지를 등록하고 가격 변동을 알림받아요.</p>
        <Link
          href="/watch/new"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-amber-200 transition hover:bg-amber-600"
        >
          + 관심 여행지 등록
        </Link>
      </div>
    </div>
  );
}
