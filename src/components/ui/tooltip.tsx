'use client';

import React from 'react';

interface TooltipProps {
  children: React.ReactNode;
}

interface TooltipContentProps {
  children: React.ReactNode;
}

interface TooltipTriggerProps {
  children: React.ReactElement;
}

export function TooltipProvider({ children }: TooltipProps) {
  return <div>{children}</div>;
}

export function Tooltip({ children }: TooltipProps) {
  return <div className="relative inline-block">{children}</div>;
}

export function TooltipTrigger({ children }: TooltipTriggerProps) {
  return React.cloneElement(children, {
    'aria-describedby': children.props['aria-describedby'] ?? undefined,
  });
}

export function TooltipContent({ children }: TooltipContentProps) {
  return (
    <div className="absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-md shadow-lg -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full">
      {children}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
    </div>
  );
}
