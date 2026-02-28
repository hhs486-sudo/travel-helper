'use client';

import { HTMLAttributes } from 'react';

type BadgeVariant = 'amber' | 'sky' | 'emerald' | 'rose' | 'slate' | 'violet';
type BadgeSize = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantClasses: Record<BadgeVariant, string> = {
  amber: 'bg-amber-100 text-amber-700 border border-amber-200',
  sky: 'bg-sky-100 text-sky-700 border border-sky-200',
  emerald: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  rose: 'bg-rose-100 text-rose-700 border border-rose-200',
  slate: 'bg-slate-100 text-slate-600 border border-slate-200',
  violet: 'bg-violet-100 text-violet-700 border border-violet-200',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export default function Badge({
  variant = 'slate',
  size = 'sm',
  children,
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </span>
  );
}
