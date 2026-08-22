import { cn } from '../../utils/helpers';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4 border-[2px]',
    md: 'w-8 h-8 border-[3px]',
    lg: 'w-12 h-12 border-[4px]',
  };

  return (
    <svg
      className={cn('loading-spinner', sizes[size], className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
      role="status"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path
        className="opacity-75"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        d="M12 2a10 10 0 0 1 10 10"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" />
    </div>
  );
}

export function InlineLoading(text = 'در حال بارگذاری...') {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <LoadingSpinner size="sm" />
      <span className="text-secondary-500 text-sm">{text}</span>
    </div>
  );
}