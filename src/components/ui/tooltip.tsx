'use client';

import React from 'react';

interface TooltipProps {
  children: React.ReactNode;
}

interface TooltipContentProps {
  children: React.ReactNode;
}

interface TooltipTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function TooltipProvider({ children }: TooltipProps) {
  return <>{children}</>;
}

export function Tooltip({ children }: TooltipProps) {
  return <>{children}</>;
}

export function TooltipTrigger({ children, asChild }: TooltipTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onMouseEnter: () => {},
      onMouseLeave: () => {},
      onFocus: () => {},
      onBlur: () => {}
    } as any);
  }
  
  return (
    <div>
      {children}
    </div>
  );
}

export function TooltipContent({ children }: TooltipContentProps) {
  return (
    <div className="absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-md shadow-lg -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full">
      {children}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
    </div>
  );
}
