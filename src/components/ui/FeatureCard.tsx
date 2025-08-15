'use client';

import { ReactNode, memo } from 'react';
import { useRouter } from 'next/navigation';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
  gradient: string;
  badge?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export const FeatureCard = memo(({
  title,
  description,
  icon,
  href,
  gradient,
  badge,
  onClick,
  className = ''
}: FeatureCardProps) => {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(href);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`${gradient} rounded-lg p-4 sm:p-6 text-white cursor-pointer hover:shadow-lg active:scale-95 transition-all duration-200 touch-manipulation select-none relative ${className}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Navigate to ${title}`}
    >
      {badge ? <div className="absolute top-2 right-2">
          {badge}
        </div> : null}
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm opacity-90">{description}</p>
    </div>
  );
});

FeatureCard.displayName = 'FeatureCard';
