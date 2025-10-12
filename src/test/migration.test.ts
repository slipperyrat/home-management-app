import { describe, it, expect, vi, beforeEach } from 'vitest';

const execSyncMock = vi.fn();
vi.mock('child_process', () => ({
  __esModule: true,
  execSync: execSyncMock,
  default: { execSync: execSyncMock },
}));

const { runMigrations } = await import('@/scripts/runMigrations');

beforeEach(() => {
  execSyncMock.mockReset();
});

describe('Migration runner', () => {
  it('returns true when migrations run without error', () => {
    execSyncMock.mockReturnValue(Buffer.from('success'));
    expect(runMigrations()).toBe(true);
  });

  it('returns false when migrations throw', () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('failure');
    });
    expect(runMigrations()).toBe(false);
  });
});
