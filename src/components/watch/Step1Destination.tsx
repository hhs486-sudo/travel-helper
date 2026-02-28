'use client';

import { useState, useRef, useEffect } from 'react';
import type { Step1FormData, DestinationSuggestion } from '@/types';
import { COMMON_ORIGINS } from '@/types';
import { searchDestinations } from '@/data/destinations';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface Step1DestinationProps {
  data: Step1FormData;
  onChange: (data: Step1FormData) => void;
  onNext: () => void;
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

export default function Step1Destination({ data, onChange, onNext }: Step1DestinationProps) {
  const [query, setQuery] = useState(data.destination?.name ?? '');
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isValid = data.origin.cityCode !== '' && data.destination !== null;

  // 검색어 변경 → 자동완성 목록 갱신
  useEffect(() => {
    if (query.trim().length === 0) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const results = searchDestinations(query);
    setSuggestions(results);
    setOpen(results.length > 0);
  }, [query]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(dest: DestinationSuggestion) {
    setQuery(dest.nameKo);
    setOpen(false);
    onChange({
      ...data,
      destination: {
        type: dest.type,
        name: dest.nameKo,
        countryCode: dest.countryCode,
        cityCode: dest.cityCode,
        airportCodes: dest.airportCodes,
      },
    });
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    // 검색어 바뀌면 선택 초기화
    if (data.destination) {
      onChange({ ...data, destination: null });
    }
  }

  function handleOriginSelect(cityCode: string) {
    const origin = COMMON_ORIGINS.find((o) => o.cityCode === cityCode);
    if (!origin) return;
    onChange({ ...data, origin: { cityCode: origin.cityCode, airportCodes: origin.airportCodes } });
  }

  return (
    <div className="space-y-6">
      {/* 출발지 선택 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs text-white">
            1
          </span>
          출발지 선택
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {COMMON_ORIGINS.map((origin) => {
            const isSelected = data.origin.cityCode === origin.cityCode;
            return (
              <Card
                key={origin.cityCode}
                padding="sm"
                hoverable
                selected={isSelected}
                selectedColor="amber"
                onClick={() => handleOriginSelect(origin.cityCode)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        'flex h-9 w-9 items-center justify-center rounded-xl text-base',
                        isSelected ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-500',
                      ].join(' ')}
                    >
                      ✈
                    </div>
                    <div>
                      <p className={['text-sm font-semibold', isSelected ? 'text-amber-700' : 'text-slate-700'].join(' ')}>
                        {origin.label}
                      </p>
                      <p className="text-xs text-slate-400">{origin.airportCodes.join(' · ')}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 목적지 자동완성 */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-xs text-white">
            2
          </span>
          목적지 검색
        </h3>

        <div className="relative">
          <div className="relative">
            {/* 검색 아이콘 */}
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </span>

            <input
              ref={inputRef}
              type="text"
              placeholder="도시명 검색 (예: 오사카, 방콕, 파리)"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              className={[
                'w-full rounded-xl border py-3 pl-10 pr-10 text-sm text-slate-700 placeholder-slate-400 outline-none transition',
                data.destination
                  ? 'border-sky-400 bg-sky-50 ring-2 ring-sky-100'
                  : 'border-slate-200 bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100',
              ].join(' ')}
            />

            {/* 선택됨 체크 / 지우기 버튼 */}
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  onChange({ ...data, destination: null });
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* 드롭다운 */}
          {open && (
            <ul
              ref={listRef}
              className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              {suggestions.map((dest) => (
                <li key={dest.id}>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sky-50"
                    onMouseDown={(e) => e.preventDefault()} // blur 방지
                    onClick={() => handleSelect(dest)}
                  >
                    <span className="text-xl leading-none">{countryFlag(dest.countryCode)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-700">
                        {dest.nameKo}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">{dest.nameEn}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {dest.countryNameKo} · {dest.airportCodes.join(', ')}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                      {dest.cityCode}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 선택된 목적지 요약 */}
        {data.destination && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <span className="text-2xl">{countryFlag(data.destination.countryCode)}</span>
            <div>
              <p className="text-sm font-bold text-sky-700">{data.destination.name}</p>
              <p className="text-xs text-sky-500">
                {data.destination.airportCodes.join(' · ')}
                {data.destination.cityCode && ` · ${data.destination.cityCode}`}
              </p>
            </div>
            <div className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-sky-500">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        <p className="mt-2 text-xs text-slate-400">
          도시명, 국가명, 공항코드(예: KIX)로 검색할 수 있어요.
        </p>
      </section>

      <Button variant="primary" size="lg" fullWidth disabled={!isValid} onClick={onNext}>
        다음 단계 — 여행 조건 입력
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Button>
    </div>
  );
}
