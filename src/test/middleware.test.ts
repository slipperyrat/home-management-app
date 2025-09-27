import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAuthState = vi.hoisted(() => ({ userId: 'user-123' as string | null }));

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: any) => (req: NextRequest) =>
    handler(async () => mockAuthState, req),
}));

import middleware from '@/middleware';

vi.mock('@/lib/api/database', () => ({
  getUserHouseholdId: vi.fn(),
  getUserOnboardingStatus: vi.fn()
}));

import { getUserHouseholdId, getUserOnboardingStatus } from '@/lib/api/database';

describe('middleware onboarding checks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuthState.userId = 'user-123';
  });

  it('redirects to onboarding when household missing', async () => {
    (getUserHouseholdId as vi.Mock).mockResolvedValue(null);
    (getUserOnboardingStatus as vi.Mock).mockResolvedValue(false);

    const request = new NextRequest('https://example.com/dashboard');
    const response = await middleware(request as any);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/onboarding');
  });

  it('allows access when onboarding complete', async () => {
    (getUserHouseholdId as vi.Mock).mockResolvedValue('household-1');
    (getUserOnboardingStatus as vi.Mock).mockResolvedValue(true);

    const request = new NextRequest('https://example.com/dashboard');
    const response = await middleware(request as any);
    expect(response.headers.get('location')).toBeNull();
  });

  it('does not redirect static asset requests', async () => {
    mockAuthState.userId = 'user-123';
    (getUserHouseholdId as vi.Mock).mockResolvedValue('household-1');
    (getUserOnboardingStatus as vi.Mock).mockResolvedValue(false);

    const assetPaths = [
      'https://example.com/fonts/font.woff2',
      'https://example.com/images/icon.png',
      'https://example.com/favicon.ico',
      'https://example.com/styles/site.css',
    ];

    for (const path of assetPaths) {
      const request = new NextRequest(path);
      const response = await middleware(request as any);
      expect(response.headers.get('location')).toBeNull();
    }
  });

  it('allows onboarding page when user unfinished', async () => {
    mockAuthState.userId = 'user-123';
    (getUserHouseholdId as vi.Mock).mockResolvedValue(null);
    (getUserOnboardingStatus as vi.Mock).mockResolvedValue(false);

    const request = new NextRequest('https://example.com/onboarding');
    const response = await middleware(request as any);
    expect(response.headers.get('location')).toBeNull();
  });
});
