'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { canAccessFeature } from '@/lib/planFeatures';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';
import { useState } from 'react';

interface FeatureGatedButtonProps {
  feature: string;
  userPlan: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function FeatureGatedButton({
  feature,
  userPlan,
  children,
  onClick,
  disabled = false,
  className,
  variant = 'default',
  size = 'default',
}: FeatureGatedButtonProps) {
  const upgradeModal = useUpgradeModal();
  const [isLoading, setIsLoading] = useState(false);
  
  const hasAccess = canAccessFeature(userPlan, feature);

  const handleClick = async () => {
    if (disabled || isLoading) return;
    
    if (!hasAccess) {
      upgradeModal.onOpen();
      return;
    }

    if (onClick) {
      setIsLoading(true);
      try {
        await onClick();
      } finally {
        setIsLoading(false);
      }
    }
  };

  const button = (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || isLoading}
      onClick={handleClick}
    >
      {isLoading ? 'Loading...' : children}
    </Button>
  );

  // Show tooltip for premium features when user doesn't have access
  if (!hasAccess) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <p>This feature requires a premium plan</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
} 