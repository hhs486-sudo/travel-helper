'use client';

import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 카드 패딩 크기 */
  padding?: 'sm' | 'md' | 'lg' | 'none';
  /** 호버 강조 효과 */
  hoverable?: boolean;
  /** 선택된 상태 강조 */
  selected?: boolean;
  /** 선택된 상태 색상 계열 */
  selectedColor?: 'amber' | 'sky' | 'emerald';
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const selectedColorClasses = {
  amber: 'border-amber-500 bg-amber-50 ring-1 ring-amber-400',
  sky: 'border-sky-500 bg-sky-50 ring-1 ring-sky-400',
  emerald: 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400',
};

export default function Card({
  padding = 'md',
  hoverable = false,
  selected = false,
  selectedColor = 'amber',
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'rounded-2xl border bg-white transition-all duration-150',
        paddingClasses[padding],
        hoverable
          ? 'cursor-pointer hover:shadow-md hover:border-amber-300'
          : '',
        selected
          ? selectedColorClasses[selectedColor]
          : 'border-slate-200 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

/** 카드 제목 섹션 */
export function CardHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
}

/** 카드 본문 섹션 */
export function CardBody({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
