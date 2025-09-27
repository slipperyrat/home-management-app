import { execSync } from 'child_process';
import { logger } from '../utils/logger';

export function runMigrations(): boolean {
  try {
    execSync('npm run migrate', { stdio: 'inherit' });
    return true;
  } catch (error) {
    logger.error('Migration run failed', error as Error);
    return false;
  }
}
