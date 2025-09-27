import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCalendarTemplates } from '@/lib/entitlements';

const mockFetch = vi.fn();
const originalFetch = global.fetch;

describe('getCalendarTemplates caching', () => {
beforeEach(() => {
    vi.resetModules();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'template-1' }],
    });
    global.fetch = mockFetch as unknown as typeof fetch;
  });

afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses cache on subsequent calls', async () => {
    const templates1 = await getCalendarTemplates('household-1');
    expect(templates1).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const templates2 = await getCalendarTemplates('household-1');
    expect(templates2).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
