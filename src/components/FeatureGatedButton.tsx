'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { canAccessFeature } from '@/lib/planFeatures';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';
import { trackFeatureUsage } from '@/lib/analytics';
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
  userId?: string;
  householdId?: string;
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
  userId,
  householdId,
}: FeatureGatedButtonProps) {
  const upgradeModal = useUpgradeModal();
  const [isLoading, setIsLoading] = useState(false);
  
  const hasAccess = canAccessFeature(userPlan, feature);

  const handleClick = async () => {
    if (disabled || isLoading) return;
    
    if (!hasAccess) {
      // Track upgrade prompt shown
      trackFeatureUsage(feature, 'upgrade_prompt_shown', userPlan, userId, householdId);
      upgradeModal.onOpen();
      return;
    }

    // Track feature usage
    trackFeatureUsage(feature, 'button_clicked', userPlan, userId, householdId);

    if (onClick) {
      setIsLoading(true);
      try {
        await onClick();
        // Track successful feature usage
        trackFeatureUsage(feature, 'action_completed', userPlan, userId, householdId);
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

  // Show tooltip for Pro features when user doesn't have access
  if (!hasAccess) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <p>This feature requires a Pro plan or higher</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
} 