import { describe, it, expect, afterEach, vi } from 'vitest';
import { getCalendarTemplates, __testing } from '@/lib/entitlements';

describe('getCalendarTemplates caching', () => {
  const householdId = 'household-1';

  afterEach(() => {
    vi.restoreAllMocks();
    __testing.calendarTemplateCache.clear();
  });

  it('uses cache on subsequent calls', async () => {
    const templateResponse = [{ id: 'template-1' }];
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(templateResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const first = await getCalendarTemplates(householdId);
    const second = await getCalendarTemplates(householdId);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});
