import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/recipes/import/route';
import * as database from '@/lib/api/database';
import * as featureModule from '@/lib/server/canAccessFeature';

vi.mock('@/lib/api/database', () => {
  const mockClient = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'recipe-123' }, error: null }),
  };

  const mocks = {
    getUserAndHouseholdData: vi.fn(),
    getDatabaseClient: vi.fn().mockReturnValue(mockClient),
    createAuditLog: vi.fn().mockResolvedValue({})
  };

  return { ...mocks, __mocks: mocks };
});

vi.mock('@/lib/server/canAccessFeature', () => {
  const mocks = {
    canAccessFeatureFromEntitlements: vi.fn(),
  };

  return { ...mocks, __mocks: mocks };
});

type DatabaseModuleWithMocks = typeof database & {
  __mocks: {
    getUserAndHouseholdData: vi.Mock;
    getDatabaseClient: vi.Mock;
  };
};

type FeatureModuleWithMocks = typeof featureModule & {
  __mocks: {
    canAccessFeatureFromEntitlements: vi.Mock;
  };
};

const databaseModule = database as DatabaseModuleWithMocks;
const featureModuleWithMocks = featureModule as FeatureModuleWithMocks;

const { getUserAndHouseholdData: getUserAndHouseholdDataMock } = databaseModule.__mocks;
const { canAccessFeatureFromEntitlements: canAccessFeatureFromEntitlementsMock } = featureModuleWithMocks.__mocks;

vi.mock('@/lib/security/apiProtection', () => ({
  withAPISecurity: (_request: NextRequest, handler: (req: NextRequest, user: { id: string }) => Promise<Response> | Response) => handler(_request, { id: 'user-123' }),
}));

describe('POST /api/recipes/import', () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;
  const userId = 'user-123';
  const householdId = 'household-456';

  let fetchMock: vi.Mock;

  beforeEach(() => {
    getUserAndHouseholdDataMock.mockResolvedValue({
      user: { id: userId },
      household: { id: householdId, plan: 'pro' },
      entitlements: { tier: 'pro', google_import: true, digest_max_per_day: 1, quiet_hours: true },
    });
    canAccessFeatureFromEntitlementsMock.mockReturnValue(true);
  
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        title: 'Imported Recipe',
        image: 'https://example.com/image.jpg',
        readyInMinutes: 30,
        servings: 4,
        analyzedInstructions: [{ steps: [{ number: 1, step: 'Mix ingredients.' }] }],
        extendedIngredients: [{
          name: 'Flour',
          amount: 2,
          unit: 'cups',
          original: '2 cups flour',
        }],
      }),
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env = { ...originalEnv, SPOONACULAR_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('successfully imports a recipe', async () => {
    const request = new NextRequest('http://localhost/api/recipes/import', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/recipe' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await POST(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.data.recipe_id).toBe('recipe-123');
    expect(database.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'recipe.imported_url',
        targetId: 'recipe-123',
      })
    );
  });

  it('returns 503 when API key is missing', async () => {
    delete process.env.SPOONACULAR_API_KEY;

    const request = new NextRequest('http://localhost/api/recipes/import', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/recipe' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(503);
  });

  it('returns 429 when Spoonacular reports quota exceeded', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue('Quota exceeded'),
    });

    const request = new NextRequest('http://localhost/api/recipes/import', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/recipe' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
  });

  it('returns 400 for missing URL', async () => {
    const request = new NextRequest('http://localhost/api/recipes/import', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 403 when entitlements do not allow recipe import', async () => {
    getUserAndHouseholdDataMock.mockResolvedValueOnce({
      user: { id: userId },
      household: { id: householdId, plan: 'free' },
      entitlements: { tier: 'free', google_import: false },
    });
    canAccessFeatureFromEntitlementsMock.mockReturnValueOnce(false);

    const request = new NextRequest('http://localhost/api/recipes/import', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com/recipe' }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.error).toBeDefined();
  });
});
