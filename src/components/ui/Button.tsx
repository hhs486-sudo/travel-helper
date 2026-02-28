'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm disabled:bg-amber-200',
  secondary:
    'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white shadow-sm disabled:bg-sky-200',
  outline:
    'border-2 border-amber-500 text-amber-600 hover:bg-amber-50 active:bg-amber-100 disabled:border-amber-200 disabled:text-amber-300',
  ghost:
    'text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-300',
  danger:
    'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white shadow-sm disabled:bg-red-200',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3 text-base rounded-xl',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    fullWidth = false,
    children,
    className = '',
    disabled,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>처리 중...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

export default Button;
