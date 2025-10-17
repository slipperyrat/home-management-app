'use client';

import * as React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = RadixTooltip.Provider;

const Tooltip = RadixTooltip.Root;

const TooltipTrigger = RadixTooltip.Trigger;

const TooltipPortal = RadixTooltip.Portal;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof RadixTooltip.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPortal>
    <RadixTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-gray-900 px-3 py-2 text-sm text-white shadow-lg",
        "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </TooltipPortal>
));
TooltipContent.displayName = RadixTooltip.Content.displayName;

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent };
