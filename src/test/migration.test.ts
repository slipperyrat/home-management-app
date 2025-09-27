import { describe, it, expect, vi } from 'vitest';
import { runMigrations } from '@/scripts/runMigrations';

vi.mock('child_process', () => ({
  execSync: vi.fn()
}));

const { execSync } = require('child_process') as { execSync: ReturnType<typeof vi.fn> };

describe('Migration runner', () => {
  it('returns true when migrations run without error', () => {
    execSync.mockReturnValue(Buffer.from('success'));
    expect(runMigrations()).toBe(true);
  });

  it('returns false when migrations throw', () => {
    execSync.mockImplementation(() => {
      throw new Error('failure');
    });
    expect(runMigrations()).toBe(false);
  });
});
