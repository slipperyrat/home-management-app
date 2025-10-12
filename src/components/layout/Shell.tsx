'use client';

import type { ReactNode } from 'react';
import ResponsiveNav from '@/components/layout/ResponsiveNav';
import { useActivePath } from '@/components/layout/NavProvider';

export default function Shell({ children }: { children: ReactNode }) {
  const activePath = useActivePath();

  return <ResponsiveNav activePath={activePath}>{children}</ResponsiveNav>;
}
