import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'glob';

const ROUTE_GLOB = 'src/app/**/route.ts?(x)';
const aliasPattern = /type\s+HandlerUser\s*=\s*{\s*id:\s*string\s*}\s*\|\s*null;\s*\n*/g;
const handlerToken = /HandlerUser/g;
const importPattern = /import\s*{([^}]*)}\s*from\s*['"]@\/lib\/security\/apiProtection['"];?/;

const files = globSync(ROUTE_GLOB, { windowsPathsNoEscape: true });

for (const file of files) {
  let contents = readFileSync(file, 'utf8');

  if (!contents.includes('HandlerUser')) {
    continue;
  }

  contents = contents.replace(aliasPattern, '');
  contents = contents.replace(handlerToken, 'RequestUser | null');

  const importMatch = contents.match(importPattern);
  if (importMatch) {
    const importSection = importMatch[1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    if (!importSection.includes('RequestUser')) {
      importSection.push('RequestUser');
    }

    const uniqueImports = Array.from(new Set(importSection));
    const replacement = `import { ${uniqueImports.join(', ')} } from '@/lib/security/apiProtection';`;
    contents = contents.replace(importPattern, replacement);
  }

  writeFileSync(file, contents, 'utf8');
}

console.log('Updated HandlerUser aliases.');
