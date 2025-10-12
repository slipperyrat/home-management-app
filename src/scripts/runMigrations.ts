import { execSync } from 'child_process';

export function runMigrations(): boolean {
  try {
    execSync('npm run migrate', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('Migration run failed', error);
    return false;
  }
}
