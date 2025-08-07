'use client';

interface ProBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProBadge({ className = '', size = 'md' }: ProBadgeProps) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-purple-600 text-white font-bold ${sizeClasses[size]} ${className}`}
    >
      Pro
    </span>
  );
} 