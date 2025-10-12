import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAuthState = vi.hoisted(() => ({ userId: 'user-123' as string | null }));

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: (getAuth: () => Promise<typeof mockAuthState>, req: NextRequest) => Promise<Response>) =>
    (req: NextRequest) => handler(async () => mockAuthState, req),
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
    vi.mocked(getUserHouseholdId).mockResolvedValue(null);
    vi.mocked(getUserOnboardingStatus).mockResolvedValue(false);

    const request = new NextRequest('https://example.com/dashboard');
    const response = await middleware(request as NextRequest);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/onboarding');
  });

  it('allows access when onboarding complete', async () => {
    vi.mocked(getUserHouseholdId).mockResolvedValue('household-1');
    vi.mocked(getUserOnboardingStatus).mockResolvedValue(true);

    const request = new NextRequest('https://example.com/dashboard');
    const response = await middleware(request as NextRequest);
    expect(response.headers.get('location')).toBeNull();
  });

  it('does not redirect static asset requests', async () => {
    mockAuthState.userId = 'user-123';
    vi.mocked(getUserHouseholdId).mockResolvedValue('household-1');
    vi.mocked(getUserOnboardingStatus).mockResolvedValue(false);

    const assetPaths = [
      'https://example.com/fonts/font.woff2',
      'https://example.com/images/icon.png',
      'https://example.com/favicon.ico',
      'https://example.com/styles/site.css',
    ];

    for (const path of assetPaths) {
      const request = new NextRequest(path);
      const response = await middleware(request as NextRequest);
      expect(response.headers.get('location')).toBeNull();
    }
  });

  it('allows onboarding page when user unfinished', async () => {
    mockAuthState.userId = 'user-123';
    vi.mocked(getUserHouseholdId).mockResolvedValue(null);
    vi.mocked(getUserOnboardingStatus).mockResolvedValue(false);

    const request = new NextRequest('https://example.com/onboarding');
    const response = await middleware(request as NextRequest);
    expect(response.headers.get('location')).toBeNull();
  });
});
