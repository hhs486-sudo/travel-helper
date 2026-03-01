'use client';

import { useState } from 'react';

const SCRAPER_API = 'http://localhost:8001';

export default function ScraperAdminPage() {
  const [logs, setLogs] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [sampleDone, setSampleDone] = useState(false);
  const [destination, setDestination] = useState<string>('');

  async function callApi(url: string, label: string) {
    setLogs(`[${label}] 실행 중...\n`);
    try {
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setLogs(`오류: ${data.error}`);
        return false;
      }
      setLogs(data.output ?? JSON.stringify(data, null, 2));
      return true;
    } catch {
      setLogs(`서버 연결 실패.\n터미널에서: cd scraper && uvicorn server:app --port 8001`);
      return false;
    }
  }

  async function runSample() {
    setRunning(true);
    setSampleDone(false);
    const params = new URLSearchParams({ limit: '5' });
    if (destination.trim()) params.set('destination', destination.trim());
    const ok = await callApi(`${SCRAPER_API}/sample?${params}`, '샘플 저장');
    if (ok) setSampleDone(true);
    setRunning(false);
  }

  async function runFull() {
    setRunning(true);
    const params = new URLSearchParams();
    if (destination.trim()) params.set('destination', destination.trim());
    await callApi(`${SCRAPER_API}/run?${params}`, '전체 저장');
    setSampleDone(false);
    setRunning(false);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-xl font-bold text-slate-800">스크래퍼 관리</h1>
      <p className="mt-1 text-sm text-slate-500">
        노랑풍선(ybtour) ·{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          cd scraper && uvicorn server:app --port 8001
        </code>
      </p>

      {/* 목적지 필터 */}
      <div className="mt-5 flex items-center gap-2">
        <label className="shrink-0 text-sm font-medium text-slate-700">목적지</label>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="예: 오사카  (비우면 전체)"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
        />
      </div>

      {/* 안내 */}
      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        ① 샘플 저장 (5개) → ② localhost 확인 → ③ 전체 저장
      </div>

      {/* 버튼 */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={runSample}
          disabled={running}
          className="flex-1 rounded-xl border border-blue-300 bg-blue-50 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors"
        >
          {running ? '실행 중...' : '① 샘플 저장 (5개)'}
        </button>
        <button
          onClick={runFull}
          disabled={running}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition-colors disabled:opacity-40 ${
            sampleDone
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'border border-slate-200 bg-white text-slate-400 hover:bg-slate-50'
          }`}
        >
          {running ? '저장 중...' : sampleDone ? '③ 전체 저장 →' : '전체 저장'}
        </button>
      </div>

      {/* 로그 */}
      {logs && (
        <pre className="mt-6 max-h-96 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-green-400 whitespace-pre-wrap">
          {logs}
        </pre>
      )}
    </div>
  );
}
