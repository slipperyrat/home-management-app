import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/analytics/track/route';
import { getDatabaseClient } from '@/lib/api/database';

vi.mock('@/lib/api/database', () => ({
  getDatabaseClient: vi.fn(),
}));

vi.mock('@/lib/security/apiProtection', () => ({
  withAPISecurity: vi.fn((request: NextRequest, handler: (req: NextRequest, user: { id: string }) => Promise<Response> | Response) => handler(request, { id: 'user-123' })),
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/app/metrics/router', () => ({
  apiRequestCounter: { inc: vi.fn() },
  apiLatencyHistogram: { observe: vi.fn() },
}));

type MockDatabaseClient = {
  from: vi.Mock<MockDatabaseClient, [string]>;
  insert: vi.Mock<Promise<{ error: unknown }> | MockDatabaseClient, [unknown]>;
};

let mockClient: MockDatabaseClient;

describe('POST /api/analytics/track', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockClient = {
      from: vi.fn(),
      insert: vi.fn(),
    };

    mockClient.from.mockReturnValue(mockClient);
    mockClient.insert.mockReturnValue(mockClient);

    vi.mocked(getDatabaseClient).mockReturnValue(mockClient as unknown as ReturnType<typeof getDatabaseClient>);
  });

  it('stores analytics event with valid payload', async () => {
    const payload = {
      event: 'test.event',
      timestamp: new Date().toISOString(),
      properties: { foo: 'bar' },
    };

    mockClient.insert.mockResolvedValue({ error: null });

    const request = new NextRequest('https://example.com/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(mockClient.from).toHaveBeenCalledWith('analytics_events');
    expect(mockClient.insert).toHaveBeenCalled();
  });

  it('rejects invalid payload', async () => {
    const payload = { event: '' };

    const request = new NextRequest('https://example.com/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid analytics payload');
  });
});
